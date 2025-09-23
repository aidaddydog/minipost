# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
ARG NPM_REGISTRY
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm i --silent; fi
COPY . .
RUN npm run build

# Stage 2: serve with caddy
FROM caddy:2.7-alpine
WORKDIR /srv
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
