# ---------- Build stage ----------
FROM node:20-bullseye AS builder
WORKDIR /app

# Evita prompts npm
ENV CI=true
ENV NODE_ENV=development

# Copia apenas os manifests primeiro (camada de cache)
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# Instala depend�ncias do backend (inclui devDependencies para permitir build TS)
# Tenta npm ci (determin�stico), se falhar faz fallback para npm install.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci || npm --prefix backend install; \
    else \
      npm --prefix backend install; \
    fi

# Instala depend�ncias do frontend (inclui devDependencies)
RUN if [ -f frontend/package-lock.json ]; then \
      npm --prefix frontend ci || npm --prefix frontend install; \
    else \
      npm --prefix frontend install; \
    fi

# Copia o restante do c�digo-fonte
COPY . .

# Instala explicitamente alguns tipos que aparecem nos logs como "missing" (devDependencies).
# Isso ajuda o tsc a compilar quando o lockfile n�o inclui esses @types.
# Se algum pacote n�o existir, o npm apenas emitir� aviso e continuar�.
RUN npm --prefix backend i -D @types/pg @types/node @types/express @types/body-parser @types/express-serve-static-core @types/qs @types/serve-static @types/connect @types/range-parser @types/send undici-types @types/mime @types/http-errors @types/swagger-jsdoc @types/swagger-ui-express || true

# Executa build do backend e do frontend
RUN npm --prefix backend run build && npm --prefix frontend run build

# (Opcional) Remova node_modules grandes do build stage se quiser reduzir o contexto que ser� copiado.
# Mas deixei node_modules no builder porque alguns projetos TypeScript preferem copiar artefatos compilados + node_modules.
# Se preferir instalar s� produ��o no final, veja a se��o Production abaixo.

# ---------- Production stage ----------
FROM node:20-bullseye-slim
WORKDIR /app

ENV NODE_ENV=production

# Cria diret�rios
RUN mkdir -p /app/backend /app/frontend

# Copia artefatos constru�dos do est�gio builder
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend

# Copia manifest do backend para instalar depend�ncias de produ��o (caso opte por instalar no final)
COPY backend/package*.json backend/

# (Op��o) Instala apenas depend�ncias de produ��o no container final.
# Se voc� j� copiou node_modules do builder, pode remover este passo.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci --omit=dev --prefer-offline --no-audit || npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    else \
      npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    fi

# Porta padr�o (ajuste conforme seu app)
EXPOSE 3000

# Comando padr�o
CMD ["npm", "--prefix", "backend", "start"]
