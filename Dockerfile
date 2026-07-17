# Kahawa Smart API — backend-only container for Fly.io.
#
# Purely additive infra: this does NOT change any application code. It installs
# the exact pinned dependencies from requirements.txt, copies the app, and runs
# the same uvicorn command you use locally.
#
# TensorFlow (2.21.0) loads the 23 MB coffee_rust_model.h5 at startup, so give
# the VM real memory headroom (see fly.toml -> [[vm]] memory).

FROM python:3.12-slim

# - PYTHONUNBUFFERED: flush stdout/stderr immediately so Fly logs show startup
#   and the background scraper's prints in real time.
# - PYTHONDONTWRITEBYTECODE: no .pyc clutter in the image layer.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# libgomp1: OpenMP runtime that TensorFlow / NumPy load at import time. The
# slim base image does not ship it, and without it `import tensorflow` fails
# with "libgomp.so.1: cannot open shared object file".
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (separate layer) so code changes don't trigger a
# full reinstall of TensorFlow on every rebuild.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application. .dockerignore keeps out secrets, the local DB, the
# training image datasets, the frontend, and dev cruft.
COPY . .

# Fly's default internal port.
EXPOSE 8080

# Same entrypoint as local development. The lifespan handler loads the Keras
# model, initialises SQLite, loads the RAG index, and starts the scraper thread.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
