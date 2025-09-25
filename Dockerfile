# ---------- Build stage ----------
FROM node:20 AS builder
WORKDIR /app

ENV CI=true
# Usar NODE_ENV=production no build evita trazer dev-only no build final quando apropriado
ENV NODE_ENV=development

# cache de manifests para camadas
COPY backend/package*.json backend/
COPY frontend/package*.json frontend/

# instalar dependências do backend (inclui dev para build TS)
RUN if [ -f backend/package-lock.json ]; then \
      npm --prefix backend ci; \
    else \
      npm --prefix backend install; \
    fi

# instalar dependências do frontend
RUN if [ -f frontend/package-lock.json ]; then \
      npm --prefix frontend ci || npm --prefix frontend install; \
    else \
      npm --prefix frontend install; \
    fi

# copiar código e buildar
COPY . .

# instalar @types extras apenas no builder (não afeta final)
RUN npm --prefix backend i -D @types/pg @types/node @types/express @types/body-parser @types/express-serve-static-core @types/qs @types/serve-static @types/connect @types/range-parser @types/send undici-types @types/mime @types/http-errors @types/swagger-jsdoc @types/swagger-ui-express || true

RUN npm --prefix backend run build
RUN npm --prefix frontend run build

# ---------- Production stage ----------
# NOTE: The build agents running our Docker image do not have credentials to
# pull images that require token-based access. Using the non-slim variant keeps
# the base image public while remaining Debian-based for compatibility.
FROM node:20 AS runtime
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000
WORKDIR /app/backend

# criar usuário não-root
RUN useradd --create-home --shell /bin/false appuser \
 && mkdir -p /app/backend \
 && chown -R appuser:appuser /app/backend

# copiar apenas o essencial do builder (artefatos + manifest)
COPY --from=builder --chown=appuser:appuser /app/backend/dist /app/backend/dist
COPY --from=builder --chown=appuser:appuser /app/backend/appsettings.json /app/backend/appsettings.json
COPY --from=builder --chown=appuser:appuser /app/backend/package*.json /app/backend/
COPY --from=builder --chown=appuser:appuser /app/frontend/dist /app/frontend/dist

# instalar apenas dependências de produção no final
RUN if [ -f /app/backend/package-lock.json ]; then \
      npm --prefix /app/backend ci --omit=dev --prefer-offline --no-audit; \
    else \
      npm --prefix /app/backend install --omit=dev --prefer-offline --no-audit; \
    fi

# metadata
LABEL org.opencontainers.image.source="seu-repo-aqui" \
      org.opencontainers.image.description="Backend - Quantum Tecnologia (produção)"

# Expor metadado (não vincula host)
EXPOSE 3000

# Healthcheck simples: tenta a porta interna
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const net=require('net');const s=net.createConnection(process.env.PORT||3000,'127.0.0.1');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"

# executar como appuser
USER appuser

# CMD — use start script que roda node dist/index.js (assegure no package.json)
CMD ["node", "dist/index.js"]
