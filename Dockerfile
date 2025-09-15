# ---------- Build stage ----------
FROM node:20-bullseye AS builder
WORKDIR /app

# Evita prompts npm
ENV CI=true
ENV NODE_ENV=development

# Copia apenas os manifests primeiro (camada de cache)
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# Instala dependências do backend (inclui devDependencies para permitir build TS)
# Tenta npm ci (determinístico), se falhar faz fallback para npm install.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci || npm --prefix backend install; \
    else \
      npm --prefix backend install; \
    fi

# Instala dependências do frontend (inclui devDependencies)
RUN if [ -f frontend/package-lock.json ]; then \
      npm --prefix frontend ci || npm --prefix frontend install; \
    else \
      npm --prefix frontend install; \
    fi

# Copia o restante do código-fonte
COPY . .

# Instala explicitamente alguns tipos que aparecem nos logs como "missing" (devDependencies).
# Isso ajuda o tsc a compilar quando o lockfile não inclui esses @types.
# Se algum pacote não existir, o npm apenas emitirá aviso e continuará.
RUN npm --prefix backend i -D @types/pg @types/node @types/express @types/body-parser @types/express-serve-static-core @types/qs @types/serve-static @types/connect @types/range-parser @types/send undici-types @types/mime @types/http-errors @types/swagger-jsdoc @types/swagger-ui-express || true

# Executa build do backend e do frontend
RUN npm --prefix backend run build && npm --prefix frontend run build

# (Opcional) Remova node_modules grandes do build stage se quiser reduzir o contexto que será copiado.
# Mas deixei node_modules no builder porque alguns projetos TypeScript preferem copiar artefatos compilados + node_modules.
# Se preferir instalar só produção no final, veja a seção Production abaixo.

# ---------- Production stage ----------
FROM node:20-bullseye-slim
WORKDIR /app

ENV NODE_ENV=production

# Cria diretórios
RUN mkdir -p /app/backend /app/frontend

# Copia artefatos construídos do estágio builder
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend

# Copia manifest do backend para instalar dependências de produção (caso opte por instalar no final)
COPY backend/package*.json backend/

# (Opção) Instala apenas dependências de produção no container final.
# Se você já copiou node_modules do builder, pode remover este passo.
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci --omit=dev --prefer-offline --no-audit || npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    else \
      npm --prefix backend install --omit=dev --prefer-offline --no-audit; \
    fi

# Porta padrão (ajuste conforme seu app)
EXPOSE 3000

# Comando padrão
CMD ["npm", "--prefix", "backend", "start"]
