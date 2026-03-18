#!/bin/bash
set -e

cd "$(dirname "$0")"

# Копируем .env если его нет
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ .env создан из .env.example"
fi

cd infra

echo "🐳 Собираем и запускаем контейнеры..."
docker compose up -d --build

echo ""
echo "⏳ Ждём готовности сервисов..."
docker compose wait postgres redis minio 2>/dev/null || sleep 10

echo ""
echo "✅ ZLP Messenger запущен!"
echo ""
echo "  🌐 Web:          http://localhost"
echo "  📡 API:          http://localhost/api"
echo "  🪣 MinIO:        http://localhost:9001  (minioadmin / minioadmin)"
echo "  📊 NATS:         http://localhost:8222"
echo ""
echo "Остановить: docker compose down"
echo "Логи:       docker compose logs -f"
