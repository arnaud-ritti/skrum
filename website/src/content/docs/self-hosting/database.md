---
title: "Database"
description: "Choose between PostgreSQL, MariaDB, MySQL and SQLite, and start Skrüm with the Compose file of your choice."
order: 4
related:
  - self-hosting/install
  - self-hosting/upgrading
  - self-hosting/configuration
---

Choose the database engine of your instance and start Skrüm with the Compose file that matches it. Choose before you install: Skrüm has no tool to move an instance from one engine to another.

## Choose an engine

| Engine | Minimum version | Choose it when |
|---|---|---|
| PostgreSQL | 14 | You have no reason to choose another. It is the default |
| MariaDB | 10.11 | It is what you already run and back up |
| MySQL | 8.4 | It is what you already run and back up |
| SQLite | 3.35 | You want one container and no database server, for a small instance |

PostgreSQL, MariaDB and MySQL let many people write at the same moment. SQLite lets one write happen at a time.

## PostgreSQL

`compose.production.yaml`, the file of [Install with Docker](../install/), starts PostgreSQL 18 in its own container. Its data is in the `pgsql-data` volume. `DB_PASSWORD` in `.env` is the only database setting to fill.

## MariaDB

1. Download the MariaDB file in place of the default one:

   ```bash
   curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.mariadb.yaml
   ```

2. Fill `.env` as [Install with Docker](../install/) says.
3. Use the file in every command:

   ```bash
   docker compose -f compose.production.mariadb.yaml up -d
   ```

The file starts MariaDB 11.8 in its own container, with the collation and the isolation level Skrüm needs. Its data is in the `mariadb-data` volume.

## SQLite

1. Download the SQLite file in place of the default one:

   ```bash
   curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.sqlite.yaml
   ```

2. Fill `APP_URL` and `APP_KEY` in `.env`. `DB_PASSWORD` is not read.
3. Use the file in every command:

   ```bash
   docker compose -f compose.production.sqlite.yaml up -d
   ```

There is no database container. The database is the file `/app/database/data/skrum.sqlite`, in the `sqlite-data` volume. The container creates it at the first start.

What "small" means: every write (a card, a vote, a reaction, a stroke on a whiteboard, a background job) waits for the one before it. A write that has waited five seconds fails with the message "The database is busy. Try again." If people see that message often, the instance has outgrown SQLite.

With this file:

- Sessions are kept as files in the `app-sessions` volume, and the cache as files in the container, so that their writes do not queue behind the application's. Recreating the container empties the cache.
- The **Active sessions** card of the account's security settings is not shown: sessions kept as files cannot be listed.
- To back up, stop the application first (`docker compose -f compose.production.sqlite.yaml stop app`), then copy the volume. While Skrüm runs, the latest writes are in a second file beside the database, and a copy of `skrum.sqlite` alone can miss them.

## MySQL, or a server you already run

No Compose file starts MySQL. To use MySQL, or a PostgreSQL or MariaDB server that already exists, edit `compose.production.yaml`:

1. Remove the `pgsql` service, the `depends_on` block of the `app` service and the `pgsql-data` volume.
2. In the `environment` block of the `app` service, set `DB_CONNECTION` to `pgsql`, `mariadb` or `mysql`, and `DB_HOST` and `DB_PORT` to your server. Values in that block win over `.env`.
3. In `.env`, set `DB_PASSWORD`, and `DB_DATABASE` and `DB_USERNAME` if they are not `skrum`.

Name the engine you run: `mariadb` for a MariaDB server, `mysql` for a MySQL server. The two do not use the same collation.

Create an empty database and let Skrüm create its tables. You do not change the server's settings: Skrüm sets what it needs on its own connection.

| Engine | What Skrüm sets | Why |
|---|---|---|
| MariaDB | The collation `utf8mb4_nopad_bin` | With a collation that ignores case, two different emoji are the same reaction and `Ada` is `ada` |
| MySQL | The collation `utf8mb4_0900_bin` | The same |
| MariaDB, MySQL | The isolation level READ COMMITTED | A limit or a uniqueness check could otherwise be passed by two requests at the same moment |
| MariaDB, MySQL | The time zone `+00:00` | Dates are stored in UTC |

## The check at every start

Before it applies the migrations, the container runs `php artisan skrum:check-database`. When the check finds a problem, the container stops and its log says what is wrong, one sentence for each problem:

- the server is older than the minimum version,
- the collation of the connection is not a binary one,
- the isolation level is not READ COMMITTED,
- tables were created with a collation that is not binary, for example by hand,
- on SQLite, the journal mode, the transaction mode or the foreign keys were changed,
- the connection is not one of the four engines.

Read the log with `docker compose -f compose.production.yaml logs app`. To run the check yourself, with the Compose file you use:

```bash
docker compose -f compose.production.yaml exec -u www-data app php artisan skrum:check-database
```

It answers "The database is ready." when it finds nothing.

## When the database is busy

Two requests can ask for the same rows at the same moment. Skrüm retries, and if the conflict remains it answers "The database is busy. Try again.", with the HTTP status 503. The request did nothing wrong: try the action again a moment later.
