# Build stage
FROM node:20-bullseye AS builder
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json backend/
RUN npm --prefix backend ci

# Install frontend dependencies
COPY frontend/package*.json frontend/
RUN npm --prefix frontend ci


# Copy application source
COPY . .

# Build backend and frontend
RUN npm --prefix backend run build && npm --prefix frontend run build

# Production stage
FROM node:20-bullseye-slim
WORKDIR /app

# Copy built applications
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend

ENV NODE_ENV=production

CMD ["npm", "--prefix", "backend", "start"]
