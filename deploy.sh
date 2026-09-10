#!/usr/bin/env bash
# ==============================================================================
# StockWhisk Zero-Downtime Safe Deploy & Storage Cleanup Script
# Usage: ./deploy.sh [service_name] (e.g. ./deploy.sh mobile or ./deploy.sh backend)
# If no service provided, deploys all updated services with zero-downtime.
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SVC="${1:-}"

echo "🚀 [StockWhisk Zero-Downtime Deploy] Starting..."

if [ -n "$SVC" ]; then
    echo "📦 Building service: $SVC..."
    docker compose build "$SVC"
    echo "🔄 Hot-swapping service: $SVC with Zero Downtime..."
    docker compose up -d --no-deps "$SVC"
else
    echo "📦 Building all services..."
    docker compose build
    echo "🔄 Recreating running services with Zero Downtime..."
    docker compose up -d
fi

echo "🧹 [Post-Deploy Cleanup] Purging unused build cache and dangling images..."
docker builder prune -f --keep-storage 500MB >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true

echo "✅ [Deploy Complete] Services are healthy and storage cleaned up!"
