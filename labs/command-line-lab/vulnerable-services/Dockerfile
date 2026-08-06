FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    docker.io \
    bash \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    flask==3.0.3 \
    websockets==12.0 \
    docker==7.1.0

COPY services/ /opt/services/
COPY configs/ /opt/configs/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /opt/services

ENTRYPOINT ["/entrypoint.sh"]
