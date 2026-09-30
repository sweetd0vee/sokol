# Production API image. Build context = repository root.
#
#   docker build -f sokol-backend/docker/app/Dockerfile -t sber/sokol-be:master .

FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SOKOL_DATA_DIR=/app/data \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --system --gid 10001 sokol \
  && useradd --system --uid 10001 --gid sokol --home-dir /app --shell /usr/sbin/nologin sokol

COPY sokol-backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY sokol-backend/app /app/app
COPY sokol-backend/alembic.ini /app/alembic.ini
COPY sokol-backend/alembic /app/alembic
COPY sokol-backend/data/images /app/data/images
COPY sokol-backend/data/*.xlsx /app/data/
COPY data/checks.xlsx data/recommendations.xlsx /app/data/
COPY sokol-backend/docker/app/entrypoint.sh /app/entrypoint.sh

RUN sed -i 's/\r$//' /app/entrypoint.sh \
  && chmod +x /app/entrypoint.sh \
  && chown -R sokol:sokol /app

USER sokol

EXPOSE 8800

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8800"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8800/api/v1/ready', timeout=2)"
