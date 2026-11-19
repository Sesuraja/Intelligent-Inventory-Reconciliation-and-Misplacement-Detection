#!/usr/bin/env bash
set -e

echo "=============================================================================="
echo "Starting Intelligent Inventory Reconciliation System via Docker Compose..."
echo "=============================================================================="
echo ""
docker compose up --build -d
echo ""
echo "Application containers launched!"
echo "Access the application at:"
echo "  - Web UI & Dashboard: http://localhost:8000/"
echo "  - API Swagger Docs:   http://localhost:8000/docs"
echo "  - System Health:       http://localhost:8000/api/v1/system/health"
echo ""

