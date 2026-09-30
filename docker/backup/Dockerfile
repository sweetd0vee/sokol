# Nightly Postgres + MinIO snapshots. Build context = repository root.
#
#   docker build -f docker/backup/Dockerfile -t sber/sokol-backup:master .

FROM postgres:16-bookworm

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 python3-pip tzdata \
  && pip3 install --break-system-packages --no-cache-dir "minio==7.2.12" \
  && rm -rf /var/lib/apt/lists/*

COPY docker/backup/backup.sh docker/backup/restore.sh docker/backup/entrypoint.sh \
     docker/backup/retention.py docker/backup/minio_sync.py docker/backup/schedule.py /opt/sokol-backup/

RUN sed -i 's/\r$//' /opt/sokol-backup/*.sh /opt/sokol-backup/*.py \
  && chmod +x /opt/sokol-backup/backup.sh /opt/sokol-backup/restore.sh \
     /opt/sokol-backup/entrypoint.sh /opt/sokol-backup/retention.py \
     /opt/sokol-backup/minio_sync.py /opt/sokol-backup/schedule.py

ENV SOKOL_BACKUP_DIR=/backups
VOLUME ["/backups"]

ENTRYPOINT ["/opt/sokol-backup/entrypoint.sh"]
