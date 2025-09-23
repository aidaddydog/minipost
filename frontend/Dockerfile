# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm i --silent; fi
COPY . .
RUN npm run build

# Stage 2: serve with caddy (static + reverse proxy)
FROM caddy:2.7-alpine
WORKDIR /srv
COPY --from=builder /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
