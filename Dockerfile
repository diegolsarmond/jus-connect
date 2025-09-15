# ---------- Build stage ----------
FROM node:20-bullseye AS builder
WORKDIR /app

# Copia apenas os manifests (para cache de camada)
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# Instala dependências do backend: tenta 'npm ci' (determinístico). Se falhar, faz fallback para 'npm install'.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci || npm --prefix backend install; \
    else \
      npm --prefix backend install; \
    fi

# Instala dependências do frontend (mesma lógica)
RUN if [ -f frontend/package-lock.json ]; then \
      npm --prefix frontend ci || npm --prefix frontend install; \
    else \
      npm --prefix frontend install; \
    fi

# Copia todo o código-fonte
COPY . .

# Executa build do backend e do frontend
RUN npm --prefix backend run build && npm --prefix frontend run build

# Remove node_modules do estágio builder para não copiar deps de desenvolvimento para a imagem final
RUN rm -rf backend/node_modules frontend/node_modules

# ---------- Production stage ----------
FROM node:20-bullseye-slim
WORKDIR /app

# Cria diretório da aplicação
RUN mkdir -p /app/backend /app/frontend

# Copia artefatos construídos do estágio builder
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend

ENV NODE_ENV=production

# Copia apenas os package*.json do backend para instalar dependências de produção (se necessário)
# Observação: se você preferir usar as node_modules já construídas no builder, remova o passo de instalação.
COPY backend/package*.json backend/

# Instala somente dependências de produção no container final.
# Tenta npm ci --omit=dev (mais determinístico); se falhar, faz fallback para npm install --omit=dev.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci --omit=dev --prefer-offline --no-audit || npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    else \
      npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    fi

# Porta exposta (ajuste se necessário)
EXPOSE 3000

# Comando padrão
CMD ["npm", "--prefix", "backend", "start"]
