# Installation & Deployment Guide

## 1. System Requirements

### 1.1 Hardware Specifications
- **Edge Computer / Server**: 4-core x86_64 or ARM64 processor, 8 GB RAM, 20 GB SSD storage.
- **Fixed UHF RFID Reader**: Multiport Impinj, Zebra, Alien, or GAO RFID reader with Ethernet/TCP connection.
- **Network**: Static IP configuration on same subnet as RFID reader.

### 1.2 Software Prerequisites
- **Python**: 3.12+ (or 3.10+)
- **Node.js**: 20+ (for building frontend)
- **Docker & Docker Compose**: (Optional, for containerized deployment)
- **Database**: PostgreSQL 16 (or local SQLite fallback)

---

## 2. Option A: Native Python Single-Command Launch (Recommended for Development)

### 2.1 Clone and Install Backend Dependencies
```bash
git clone <repository-url>
cd "D1 - Intelligent Inventory Reconciliation and Misplacement Detection"

cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
```

### 2.2 Build Frontend Single-Page Application
```bash
cd ../frontend
npm install
npm run build
cd ..
```

### 2.3 Run the Unified Server
```bash
python run_server.py
```
This single Python command will:
1. Verify the compiled React UI at `frontend/dist`.
2. Seed the database with warehouse, RFID hardware, products, and models.
3. Start the background RFID event collector and physics simulator.
4. Launch Uvicorn serving:
   - **React SaaS Web UI**: [http://localhost:8000/](http://localhost:8000/)
   - **FastAPI REST API**: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
   - **Interactive OpenAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Real-Time WebSockets**: `ws://localhost:8000/ws/rfid-events`

---

## 3. Option B: Docker Compose Multi-Container Deployment

### 3.1 Windows Quick Launch
Double-click `run_docker.bat` or run in terminal:
```cmd
run_docker.bat
```

### 3.2 Linux / macOS Quick Launch
```bash
chmod +x run_docker.sh
./run_docker.sh
```

### 3.3 Manual Docker Compose Command
```bash
docker compose up --build -d
```

### 3.4 Container Services
- **`app`**: Multi-stage container hosting the FastAPI backend, background RFID worker, and compiled React UI.
- **`postgres`**: PostgreSQL 16 Alpine container with persistent volume storage `postgres_data`.
- **Healthcheck**: Configured on `http://localhost:8000/api/v1/system/health`.

---

## 4. Environment Variables (`.env`)

| Variable | Default Value | Description |
|---|---|---|
| `APP_ENV` | `development` | Runtime environment (`development`, `production`) |
| `DATABASE_URL` | `postgresql+psycopg://app_user:app_pass@localhost:5432/inventory_db` | Connection string for database |
| `JWT_SECRET` | `secret-key-change-in-production` | Secret key for signing JWT auth tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token validity duration |
| `RFID_READER_HOST` | `192.168.1.100` | Fixed RFID reader IP address |
| `RFID_READER_PORT` | `5084` | Fixed reader TCP communication port (LLRP default: 5084) |
| `RFID_OBSERVATION_WINDOW_SECONDS`| `10` | Sliding feature aggregation window duration |
| `AI_MODEL_DIRECTORY` | `./ml/model_artifacts` | Directory for serialized model weights |

