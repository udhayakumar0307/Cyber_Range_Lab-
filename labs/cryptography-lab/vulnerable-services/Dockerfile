FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y docker.io procps && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir flask requests

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 9500

ENTRYPOINT ["/entrypoint.sh"]
