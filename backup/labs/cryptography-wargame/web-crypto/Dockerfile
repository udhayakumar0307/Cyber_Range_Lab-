FROM python:3.12-slim
WORKDIR /app
COPY web-crypto/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ ./common/
COPY web-crypto/ ./web-crypto/
RUN chmod +x web-crypto/entrypoint.sh
EXPOSE 8019 8020
CMD ["sh", "web-crypto/entrypoint.sh"]
