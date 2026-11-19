# ==============================================================================
# Multi-Stage Dockerfile for Intelligent Inventory Reconciliation & Misplacement
# Detection System
#
# Stage 1: Build the React + TypeScript SaaS Frontend with Node.js 20
# Stage 2: Package Python 3.12 Backend, dependencies, and serve unified app
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Build
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Copy package descriptors
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source code and compile Vite production bundle
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Python Backend & Production Runner
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

WORKDIR /app

# Install system dependencies for C extensions / PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend application code
COPY backend /app/backend

# Copy compiled React distribution from Stage 1 into expected static mount path
COPY --from=frontend-builder /build/dist /app/frontend/dist

# Copy unified server launcher
COPY run_server.py /app/run_server.py

# Environment configuration
ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL="sqlite:////app/inventory_rfid.db" \
    PORT=8000 \
    HOST="0.0.0.0"

# Expose unified application port (FastAPI REST API + WebSockets + React UI)
EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/system/health || exit 1

# Default execution entrypoint
CMD ["python", "run_server.py", "--host", "0.0.0.0", "--port", "8000", "--no-reload"]

