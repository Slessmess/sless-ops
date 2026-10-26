FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim

WORKDIR /app

RUN groupadd -r mcp && useradd -r -g mcp -d /app -s /bin/bash mcp

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN chown -R mcp:mcp /app

USER mcp

ENTRYPOINT ["node", "dist/index.js"]
