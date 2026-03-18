FROM node:20-alpine AS builder

WORKDIR /app

# Build args → Vite env vars (встраиваются в бандл на этапе сборки)
ARG VITE_API_URL=http://localhost/api
ARG VITE_WS_URL=ws://localhost/ws
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Runtime image ──────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
