# Use a slim Python base image
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies first, as they change infrequently
RUN apt-get update && apt-get install -y --no-install-recommends \
    supervisor \
    nginx \
    curl \
    dos2unix \
    ca-certificates \
    gnupg \
    python3-pip \
    # Build tools for Python C/C++ extensions
    build-essential \
    gcc \
    g++ \
    python3-dev \
    # Add textract dependencies
    antiword \
    poppler-utils \
    tesseract-ocr \
    unrtf \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir -r requirements.txt

# --- Build Arguments ---
ARG OPENAI_API_KEY
ARG OPENAI_MODEL_NAME

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    DEBIAN_FRONTEND=noninteractive \
    OLLAMA_HOST=0.0.0.0

# Conditional Ollama installation
RUN if [ "$OPENAI_API_KEY" = "ollama" ]; then \
    echo "Ollama API key detected. Installing Ollama..."; \
    curl -fsSL https://ollama.com/install.sh | sh; \
    echo "Pulling model: ${OPENAI_MODEL_NAME}"; \
    /usr/local/bin/ollama pull ${OPENAI_MODEL_NAME}; \
    else \
    echo "Ollama configuration not detected. Skipping installation."; \
    fi

RUN mkdir -p /etc/supervisor/conf.d /var/log/supervisor

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY nginx.conf /etc/nginx/sites-available/sentient
COPY . .

RUN if [ -f /app/.env ]; then dos2unix /app/.env; fi \
    && dos2unix /app/start.sh \
    && chmod +x /app/start.sh

RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/sentient /etc/nginx/sites-enabled/sentient

EXPOSE 5000

CMD ["/app/start.sh"]
