#!/usr/bin/env bash
# MessMind — one-command setup & start. Opens on http://localhost:8000
set -e
cd "$(dirname "$0")"
if [ ! -d backend/.venv ]; then
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -r backend/requirements.txt
fi
if [ ! -d frontend/dist ]; then
  (cd frontend && npm install && npm run build)
fi
cd backend && .venv/bin/uvicorn main:app --port 8000
