FROM python:3.12-slim
WORKDIR /app
COPY portal/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ ./common/
COPY generator.py .
COPY portal/ ./portal/
ENV VAULT_DIR=/srv/vault LEVELS_DIR=/srv/levels STATE_DIR=/srv/state PORT=5000
EXPOSE 5000
CMD ["python", "portal/app.py"]
