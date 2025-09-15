# ---------- Build stage ----------
FROM node:20-bullseye AS builder
WORKDIR /app

# Copia apenas os manifests (para cache de camada)
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# Instala depend�ncias do backend: tenta 'npm ci' (determin�stico). Se falhar, faz fallback para 'npm install'.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci || npm --prefix backend install; \
    else \
      npm --prefix backend install; \
    fi

# Instala depend�ncias do frontend (mesma l�gica)
RUN if [ -f frontend/package-lock.json ]; then \
      npm --prefix frontend ci || npm --prefix frontend install; \
    else \
      npm --prefix frontend install; \
    fi

# Copia todo o c�digo-fonte
COPY . .

# Executa build do backend e do frontend
RUN npm --prefix backend run build && npm --prefix frontend run build

# Remove node_modules do est�gio builder para n�o copiar deps de desenvolvimento para a imagem final
RUN rm -rf backend/node_modules frontend/node_modules

# ---------- Production stage ----------
FROM node:20-bullseye-slim
WORKDIR /app

# Cria diret�rio da aplica��o
RUN mkdir -p /app/backend /app/frontend

# Copia artefatos constru�dos do est�gio builder
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend

ENV NODE_ENV=production

# Copia apenas os package*.json do backend para instalar depend�ncias de produ��o (se necess�rio)
# Observa��o: se voc� preferir usar as node_modules j� constru�das no builder, remova o passo de instala��o.
COPY backend/package*.json backend/

# Instala somente depend�ncias de produ��o no container final.
# Tenta npm ci --omit=dev (mais determin�stico); se falhar, faz fallback para npm install --omit=dev.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci --omit=dev --prefer-offline --no-audit || npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    else \
      npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    fi

# Porta exposta (ajuste se necess�rio)
EXPOSE 3000

# Comando padr�o
CMD ["npm", "--prefix", "backend", "start"]
