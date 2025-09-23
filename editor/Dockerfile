FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py /app/app.py
COPY templates /app/templates
COPY static /app/static

ENV ROOT_DIR=/workspace
ENV EDITOR_PORT=6006

EXPOSE 6006
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "6006", "--proxy-headers"]
