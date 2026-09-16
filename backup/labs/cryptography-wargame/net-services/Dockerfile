FROM python:3.12-slim
WORKDIR /app
COPY net-services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY common/ ./common/
COPY net-services/ ./net-services/
EXPOSE 6507 6508 6509 6510 6511 6517 6518
CMD ["python", "net-services/server.py"]
