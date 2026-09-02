FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV SOKOL_DATA_DIR=/app/data

COPY sokol-backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY sokol-backend/app /app/app
COPY sokol-backend/data/images /app/data/images
COPY sokol-backend/data/*.xlsx /app/data/
COPY data/checks.xlsx data/recommendations.xlsx /app/data/
COPY sokol-backend/docker/app/entrypoint.sh /app/entrypoint.sh

RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8800"]
