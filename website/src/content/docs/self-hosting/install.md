---
title: Install with Docker
description: Start a Skrüm instance from the published image with Docker Compose.
order: 2
related:
  - self-hosting/requirements
  - self-hosting/configuration
  - self-hosting/database
  - self-hosting/upgrading
---

Start a Skrüm instance with Docker Compose, choose how it is served, and create the account that administers it. Read [Requirements](../requirements/) first. The image is published to GitHub Container Registry.

## Download the files

```bash
curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.production.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
```

The first two commands save the Compose file and the settings file, `.env`, side by side. The last command prints the value for `APP_KEY`.

This Compose file starts PostgreSQL beside the application. For MariaDB, MySQL or SQLite, see [Database](../database/) before you go on.

## Fill the three values

At the top of `.env`:

| Variable | Value |
|---|---|
| `APP_URL` | The public address of the instance, as typed in the browser |
| `APP_KEY` | The value just printed |
| `DB_PASSWORD` | A strong password for the database |

Everything else has a working default. Compose refuses to start without `DB_PASSWORD`, and the container stops with a message in its log without `APP_KEY`.

Then fill the mail block of the same file, and remove the `#` in front of its lines:

```ini
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=skrum
MAIL_PASSWORD=your-password
MAIL_FROM_ADDRESS=skrum@example.com
```

The first account, created with a password, confirms its address from a link sent by mail, so mail must work before you create it.

## Choose how the instance is served

The image contains the Caddy web server. `SERVER_NAME` in `.env` tells it what to serve.

| `SERVER_NAME` | Result | Also needed |
|---|---|---|
| `:80` (the default) | Plain HTTP on port 80, for a reverse proxy of yours that terminates TLS | `TRUSTED_PROXIES`: `*`, or the IP addresses of the proxy separated by commas, so that Skrüm builds `https` addresses and reads the visitor's IP address from the proxy |
| A domain, such as `skrum.example.com` | Caddy obtains and renews a certificate for that domain and serves HTTPS | The domain points to the host, and ports 80 and 443 of the host are reachable from the internet |

The forms `http://:80` and `https://skrum.example.com` are accepted too. Do not give several addresses, or a domain followed by a port: the health check of the container supports neither.

Web pages and websockets share one port. Caddy passes the paths `/app/*` and `/apps/*` to the realtime server inside the container, so a reverse proxy forwards everything to the one port, websocket connections included.

### Ports

The container is published on ports 80 and 443 of the host. Change them with `SKRUM_HTTP_PORT` and `SKRUM_HTTPS_PORT` in `.env`.

> Caddy can obtain a certificate only through ports 80 and 443. Change the host ports only with `SERVER_NAME=:80` behind a proxy, or for a local test.

## Start it

```bash
docker compose -f compose.production.yaml up -d
```

At every start the container checks the database, then applies the pending migrations, then starts the application. With the defaults, Skrüm answers on `http://<host>`.

After you change `.env`, run the same command again: Compose recreates the container with the new values.

## Create the first account

1. Open the address of the instance in a browser.
2. Select **Create an account** and fill the form.
3. Open the mail Skrüm sends you and follow its link to confirm your address.

> The first account to sign up becomes the instance admin. Create it right after starting.

After the first account, who may sign up depends on `SKRUM_SIGNUP_MODE`. The default, `invite`, admits only people who were invited. See [Configuration reference](../configuration/).

## Volumes

The Compose file keeps the data in named volumes. A container that is recreated loses everything else.

| Volume | Mounted on | Holds |
|---|---|---|
| `pgsql-data` | the database container | The database |
| `app-storage` | `/app/storage/app` | Uploaded files, such as profile photos and brand assets |
| `caddy-data` | `/data` | The certificates Caddy obtained |
| `caddy-config` | `/config` | Caddy's own configuration state |

Back up `pgsql-data` and `app-storage` together. If you replace a named volume with a folder of the host, the folders mounted on `/app/storage/app`, `/data` and `/config` must be writable by the user id 82 (`www-data` in the image).

## Use another name for the settings file

Compose reads `.env` twice: to fill the `${...}` values of the Compose file (image, ports, database name, user and password), and as the environment of the `app` container. To keep the settings in a file with another name:

1. Pass `--env-file <file>` to every `docker compose` command. It fills the `${...}` values.
2. In the Compose file, change the `env_file:` entry of the `app` service to the same file.

## If a container keeps restarting

```bash
docker compose -f compose.production.yaml logs app
```

The log names the cause, for example a missing variable or a database that Skrüm does not support.
