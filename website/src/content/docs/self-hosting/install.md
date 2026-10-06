---
title: Install with Docker
description: Start a Skrüm instance from the published image with Docker Compose.
order: 2
related:
  - getting-started/introduction
---

The image is published to GitHub Container Registry. You need Docker with the Compose plugin and a host your team can reach.

## Download the files

```bash
curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.production.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
```

The last command prints the value for `APP_KEY`.

## Fill the three values

At the top of `.env`:

| Variable | Value |
|---|---|
| `APP_URL` | The public address of the instance, as typed in the browser |
| `APP_KEY` | The value just printed |
| `DB_PASSWORD` | A strong password for the database |

Everything else has a working default.

## Start it

```bash
docker compose -f compose.production.yaml up -d
```

Skrüm answers on `http://<host>`, plain HTTP on port 80, meant for a reverse proxy that terminates TLS.

> The first account to sign up becomes the instance admin. Create it right after starting.

## If a container keeps restarting

```bash
docker compose -f compose.production.yaml logs app
```

The log names the cause, for example a missing variable.
