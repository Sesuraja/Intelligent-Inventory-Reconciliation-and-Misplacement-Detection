# Installation & Deployment Guide

## 1. Prerequisites

- **Python:** 3.11, 3.12, or 3.14 (with `pip`)
- **Node.js:** 18+ or 20+ (with `npm`)
- **Docker & Docker Compose:** Optional for containerized deployment
- **PostgreSQL:** Version 15+ (optional; SQLite WAL is used by default)

---

## 2. Quickstart with Local Python & Node.js

### Step 1: Clone the Repository
```bash
git clone https://github.com/Sesuraja/Intelligent-Inventory-Reconciliation-and-Misplacement-Detection.git
cd "Intelligent-Inventory-Reconciliation-and-Misplacement-Detection"
```

### Step 2: Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure `JWT_SECRET` is set to a secure 32+ byte string.

### Step 3: Install Dependencies
Install Python dependencies:
```bash
pip install -r backend/requirements.txt
```
Install Frontend dependencies:
```bash
npm --prefix frontend install
```

### Step 4: Run Unified Server
```bash
python run_server.py
```
- **Backend API & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **React SaaS Web Application:** [http://localhost:8000](http://localhost:8000) (or Vite dev preview at `http://localhost:5173`)
- **WebSockets Live Telemetry:** `ws://localhost:8000/ws/rfid-events`

---

## 3. Deployment with Docker Compose

To deploy PostgreSQL and the unified application container:

```bash
docker-compose up --build -d
```

### Security Architecture in Docker:
- PostgreSQL container is protected and bound strictly to `127.0.0.1:5432` on localhost.
- External containers and host services cannot access the database directly without explicit host loopback.
- Internal communication between `app` and `db` occurs over the isolated Docker bridge network.

### Health Check Verification
```bash
curl http://localhost:8000/api/v1/system/health
```

---

## 4. Running the Test Suite

Run all automated unit, integration, and security tests:
```bash
python -m pytest
```
*Current test suite: 37 automated tests passing in ~16s.*
