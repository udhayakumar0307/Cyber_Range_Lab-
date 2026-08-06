FROM python:3.11-slim

WORKDIR /app

RUN pip install flask flask-cors

COPY app.py .
COPY templates/ templates/

EXPOSE 5000

CMD ["python", "app.py"]
