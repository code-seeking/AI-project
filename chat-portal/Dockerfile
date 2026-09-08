# ---- Build Stage ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# ---- Backend Stage ----
FROM node:20-alpine
WORKDIR /app

# Install PowerShell for desktop automation
RUN apk add --no-cache pwsh

# Copy backend
COPY backend/package*.json ./
RUN npm ci --production

COPY backend/ ./

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./public

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

VOLUME ["/app/data"]

CMD ["node", "server.js"]
