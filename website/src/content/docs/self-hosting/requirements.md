---
title: "Requirements"
description: "What you need before installing Skrüm: a host with Docker, a database, an address and a way to send mail."
order: 1
related:
  - self-hosting/install
  - self-hosting/database
  - self-hosting/configuration
---

Check four things before you install Skrüm: a host that runs Docker, a database, the address your team will type, and a way to send mail. This page is for the person who hosts the instance.

## A host with Docker

- Docker with the Compose plugin. Docker's [Install Docker Compose](https://docs.docker.com/compose/install/) page lists the ways to get it.
- A `linux/amd64` or `linux/arm64` machine: the image `ghcr.io/arnaud-ritti/skrum` is built for both.

One container runs the whole application: the web server, the realtime server, the queue worker and the scheduler ([Processes and status](../processes/)). There is nothing else to install: sessions, the cache and the queue are kept in the database.

## A database

Skrüm runs on four engines. The Compose files of the project start one for you.

| Engine | Minimum version | What the Compose file starts |
|---|---|---|
| PostgreSQL | 14 | PostgreSQL 18, in its own container (the default) |
| MariaDB | 10.11 | MariaDB 11.8, in its own container |
| MySQL | 8.4 | nothing: you bring the server |
| SQLite | 3.35 | no server: one file in a volume, for a small instance |

[Database](../database/) says which to choose and what each needs.

## An address and HTTPS

`APP_URL` is the address of the instance, exactly as people type it in the browser. Skrüm builds from it the links in its mails and the callback addresses of the sign-in providers and the integrations. It also decides two things in the browser:

- Live updates travel over a websocket, which is accepted only from a page opened on the host name of `APP_URL`.
- Passkeys are registered for the host name of `APP_URL`, and browsers offer them only on an HTTPS page.

When `APP_URL` starts with `https://`, the session cookie is sent over HTTPS only. Connecting a team to Slack also needs it: Slack accepts an HTTPS redirect address only.

There are two ways to serve HTTPS, both described in [Install with Docker](../install/):

- The Caddy server built into the image obtains and renews a certificate by itself. Your domain must point to the host, and ports 80 and 443 of the host must be reachable from the internet.
- Your own reverse proxy terminates TLS and forwards plain HTTP to the container. Web pages and websockets share one port, so the proxy has one upstream and must let websocket connections through.

### On a private network

Skrüm works on a network that the internet cannot reach. These things change:

| What | On a private network |
|---|---|
| Certificates from the built-in Caddy | Not available. Use your own reverse proxy and certificate |
| Status sync from Jira, Linear and GitHub | Those services cannot call the instance, so Skrüm asks them for changes every 5 minutes instead (`INTEGRATIONS_POLL_MINUTES`) |
| The password breach check, the update check, GIFs, AI features, integrations | Each needs outbound access from the container to its service. See [Configuration reference](../configuration/) to turn the first one off |

Skrüm treats the instance as reachable when `APP_URL` uses `https`, its host is a domain name and not an IP address or a name ending in `.local`, `.localhost`, `.test`, `.internal`, `.lan` or `.home.arpa`, and that name resolves to a public address. `INTEGRATIONS_INBOUND_WEBHOOKS` overrides that guess.

## Outgoing mail

Skrüm sends mail through an SMTP server that you provide. It is used for:

- the link that confirms the address of a new account,
- password resets,
- sign-in by magic link and sign-in codes sent by email,
- invitations to a workspace,
- the daily reminders of action items,
- the results of a retrospective sent by email.

Until the `MAIL_*` variables are set, the mailer is `log`: nothing is delivered. Once the instance runs, an instance admin can also set the server in Administration: see [Mail](../../administration/mail/).

> The first account, when you create it with a password, must confirm its address from a link sent by mail before it can use the application. Set the mail variables before you create it.

## Optional services

Each one is off until you configure it. Skrüm hides the matching feature in the meantime.

| Service | What it adds | Set with |
|---|---|---|
| A language model: Anthropic, OpenAI, or any server that speaks the OpenAI API | Survey drafts from a prompt, name suggestions for groups of cards, the summary of a completed retro | `SKRUM_LLM_*` |
| A GIF provider: Giphy or Tenor | GIFs in cards and games | `SKRUM_GIF_*`, or Administration |
| Sign-in providers: Google, GitHub, Microsoft Entra, any OpenID Connect provider | Single sign-on | Their variables, or Administration |
| Slack, Telegram, Microsoft Teams, Mattermost, Jira, Linear, GitHub | Messages to a channel, export and sync of action items, import of tasks | Their variables, or Administration |

[Configuration reference](../configuration/) lists every variable.
