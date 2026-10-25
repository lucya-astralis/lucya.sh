FROM python:3.13-alpine
WORKDIR /app
COPY spotify-nowplaying.py .
# unbuffered, so `docker compose logs` shows poll errors as they happen
ENV PYTHONUNBUFFERED=1 \
    NOWPLAYING_STATE=/data/token.json \
    NOWPLAYING_OUT=/out/nowplaying.json
ENTRYPOINT ["python3", "/app/spotify-nowplaying.py"]
CMD ["run"]
