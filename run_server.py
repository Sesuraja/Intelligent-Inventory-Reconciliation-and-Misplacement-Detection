#!/usr/bin/env python3
"""
Intelligent Inventory Reconciliation & Misplacement Detection System
Unified Python Server Launcher

Runs the complete application:
- React SaaS Frontend:        http://localhost:8000/
- Interactive Swagger API:    http://localhost:8000/docs
- Live UHF RFID Telemetry:    ws://localhost:8000/ws/rfid-events
- AI Exception Diagnostics:   http://localhost:8000/api/v1/exceptions

Usage:
    python run_server.py
    python run_server.py --port 8080 --reload
    python run_server.py --host 0.0.0.0 --port 8000
"""

import sys
import os

# Limit OpenBLAS threads to prevent memory allocation contention on Windows
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
import argparse
import subprocess

def check_dependencies():
    """Verify essential Python packages are available."""
    required = ["fastapi", "uvicorn", "sqlalchemy", "sklearn", "pydantic"]
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    
    if missing:
        print("\n" + "=" * 60)
        print(" [WARNING] Missing required Python packages:")
        for m in missing:
            print(f"   - {m}")
        print("\n Install them by running:")
        print("   pip install -r backend/requirements.txt")
        print("=" * 60 + "\n")

def main():
    parser = argparse.ArgumentParser(
        description="Run the Intelligent Inventory Reconciliation & Misplacement Detection Server"
    )
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    parser.add_argument("--reload", action="store_true", default=True, help="Enable auto-reload on code changes (default: True)")
    parser.add_argument("--no-reload", dest="reload", action="store_false", help="Disable auto-reload")
    
    args = parser.parse_args()

    # Ensure backend directory is in sys.path
    project_root = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(project_root, "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    os.chdir(backend_dir)
    check_dependencies()

    print("\n" + "=" * 70)
    print("  🚀 Starting Intelligent Inventory Reconciliation & Misplacement Detection")
    print("=" * 70)
    print(f"  • Web UI (React Dashboard): http://localhost:{args.port}/")
    print(f"  • Interactive OpenAPI Docs: http://localhost:{args.port}/docs")
    print(f"  • System Health Endpoint:   http://localhost:{args.port}/api/v1/system/health")
    print(f"  • Live Telemetry Stream:    ws://localhost:{args.port}/ws/rfid-events")
    print(f"  • Host: {args.host} | Port: {args.port} | Auto-Reload: {args.reload}")
    print("=" * 70 + "\n")

    import uvicorn
    uvicorn.run("app.main:app", host=args.host, port=args.port, reload=args.reload)

if __name__ == "__main__":
    main()
