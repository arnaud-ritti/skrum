---
title: "Configuration reference"
description: "Every environment variable, and the settings that Administration overrides."
order: 3
related:
  - self-hosting/install
  - administration/general-and-branding
  - administration/sign-in-and-sso
  - administration/mail
  - administration/integration-apps
---

Skrüm reads its configuration from the environment: the `.env` file beside the Compose file. This page lists the variables by topic, with their default and what they do. It is for the person who hosts the instance.

After a change to `.env`, run `docker compose -f compose.production.yaml up -d` again: Compose recreates the container with the new values.

## What Administration overrides

An instance admin can enter some of these settings in **Administration** instead of `.env`:

| In Administration | Settings |
|---|---|
| **General** | The sign-up mode and its email domains |
| **Branding** | The name of the instance, the avatar style, the GIF provider |
| **SSO authentication** | The sign-in providers |
| **SMTP** | Outgoing mail |
| **Integrations** | The application of each integration |

A value saved in Administration wins over its environment variable, field by field. The environment stays the default: a field shows where its value comes from, and **Use the environment value** returns to it. Saving a sign-in provider, the mail settings or an integration asks for your password again when you confirmed it more than five minutes ago.

Secrets saved in Administration are encrypted with `APP_KEY`. If you change `APP_KEY`, they can no longer be read and Skrüm falls back to the environment values: enter them again.

These settings have no field in Administration and are read from the environment only: `APP_URL` and the callback addresses built from it, `INTEGRATIONS_*`, `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS`, `OUTGOING_WEBHOOKS_ALLOW_HTTP`, `GITHUB_APP_PRIVATE_KEY_PATH`, and mailers other than `smtp` and `log`.

## Required

| Variable | Default | What it does |
|---|---|---|
| `APP_URL` | none | The public address of the instance, as typed in the browser. Skrüm builds its links and callback addresses from it, accepts websockets from its host name and registers passkeys for it |
| `APP_KEY` | none | The encryption key. Print one with `docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show`. The container does not start without it |
| `DB_PASSWORD` | none | The password of the database. Not read with SQLite |

## Serving

| Variable | Default | What it does |
|---|---|---|
| `SERVER_NAME` | `:80` | The address the built-in Caddy serves: `:80` for plain HTTP behind a reverse proxy, or a domain for automatic HTTPS. See [Install with Docker](../install/) |
| `TRUSTED_PROXIES` | empty | `*`, or the IP addresses of your reverse proxy separated by commas. Set it whenever a proxy sits in front |
| `SKRUM_HTTP_PORT` | `80` | The host port published for HTTP. Read by the Compose file |
| `SKRUM_HTTPS_PORT` | `443` | The host port published for HTTPS. Read by the Compose file |
| `SKRUM_IMAGE` | `ghcr.io/arnaud-ritti/skrum:latest` | The image the Compose file starts. See [Upgrading](../upgrading/) to pin a version |
| `SKRUM_RUN_MIGRATIONS` | `true` | Apply the pending database migrations when the container starts |
| `OCTANE_WORKERS` | `auto` | The number of application workers. With `auto`, the server starts two per CPU |
| `OCTANE_MAX_REQUESTS` | `500` | The number of requests a worker serves before it is replaced |
| `LOG_LEVEL` | `warning` | The lowest level written to the container log |

The container refuses to start with `APP_DEBUG=true`, because debug pages show the configuration; `SKRUM_ALLOW_DEBUG=true` lifts that refusal. The Compose files set `APP_DEBUG` to `false`. Leave `INERTIA_SSR_ENABLED` at `false`: the image does not contain the server-side renderer.

## Instance

| Variable | Default | What it does |
|---|---|---|
| `APP_NAME` | `Skrum` | The name shown in the interface and the mails |
| `APP_LOCALE` | `en` | The default language: `en`, `fr`, `es` or `de` |
| `APP_TIMEZONE` | `UTC` | The time zone of the instance. It decides the day an action item becomes overdue and the hour of the daily reminders. Set it before first use: it also decides how stored times are read |
| `SKRUM_AVATAR_STYLE` | `thumbs` | The DiceBear style of the generated avatars |
| `SKRUM_VERSION` | set by the image | The version shown in Administration and to signed-in members on error pages |
| `SKRUM_UPDATE_CHECK_ENABLED` | `true` | Check for a new release daily. Set to `false` to disable the environment default; a saved Administration › General setting takes precedence |
| `SKRUM_UPDATE_FEED` | the latest GitHub release of the project | The address asked by the update check. See [Upgrading](../upgrading/) |

## Sign-up and accounts

| Variable | Default | What it does |
|---|---|---|
| `SKRUM_SIGNUP_MODE` | `invite` | Who may create an account, after the first one. See below |
| `SKRUM_REQUIRE_EMAIL_VERIFICATION` | `true` | Require email verification before using the instance. Set to `false` to make it optional; Administration › General can override it |
| `SKRUM_ALLOWED_EMAIL_DOMAINS` | empty | The email domains admitted by the `domain` mode, separated by commas |
| `SKRUM_PASSWORD_BREACH_CHECK` | `true` | Check a new password against known data breaches. Only the first five characters of its SHA-1 hash are sent, to `api.pwnedpasswords.com`. Set it to `false` when the container has no outbound access |
| `SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT` | `5` | Seconds to wait for that check |
| `PASSKEYS_USER_HANDLE_SECRET` | the value of `APP_KEY` | The secret that ties a passkey to its account. Before you change `APP_KEY` on a running instance, set this variable to the current `APP_KEY`, or every registered passkey stops working |
| `SESSION_SECURE_COOKIE` | `true` when `APP_URL` starts with `https://` | Send the session cookie over HTTPS only |

### Sign-up mode

| `SKRUM_SIGNUP_MODE` | In Administration | Who may create an account |
|---|---|---|
| `invite` | **Invitation only** | People invited to a workspace by email, and people who hold a team's invite link |
| `open` | **Open to everyone** | Anyone who reaches the instance |
| `domain` | **Allowed domains** | People whose email address belongs to one of the allowed domains, and people invited by email |

The first account can always be created, whatever the mode: it becomes the instance admin.

### Email verification

Email verification is required by default. Set `SKRUM_REQUIRE_EMAIL_VERIFICATION=false` to let signed-in members use the instance without verifying their email, then restart or redeploy the application to apply the environment change.

In **Administration › General › Email verification**, **Required** and **Optional** override the environment value. **Use environment default** clears that override. Save the form to apply an admin change. Making verification optional leaves each account’s actual verification status intact; email-based sign-in and email two-factor authentication still require a verified address.

### Sign-in providers

A provider appears on the sign-in page when all its values are set. The callback address to give the provider is `{APP_URL}/auth/google/callback`, with `github`, `entra` or `oidc` in place of `google`. [Sign-in and SSO](../../administration/sign-in-and-sso/) describes what to create at each provider.

| Provider | Variables |
|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Microsoft Entra | `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT` (default `common`) |
| OpenID Connect | `OIDC_BASE_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_LABEL` (the name of the provider on the sign-in page, optional) |

## Mail

| Variable | Default | What it does |
|---|---|---|
| `MAIL_MAILER` | `log` | `smtp` to deliver mail. With `log`, nothing is delivered |
| `MAIL_HOST` | `127.0.0.1` | The SMTP server |
| `MAIL_PORT` | `2525` | Its port |
| `MAIL_SCHEME` | empty | `smtp` or `smtps` |
| `MAIL_USERNAME` | empty | The SMTP user |
| `MAIL_PASSWORD` | empty | The SMTP password |
| `MAIL_FROM_ADDRESS` | `hello@example.com` | The sender's address |
| `MAIL_FROM_NAME` | the value of `APP_NAME` | The sender's name |

With the `log` mailer, a mail is written to the log at the `debug` level, below the `warning` level the image logs from: it does not appear in `docker compose logs`.

## Action item reminders

| Variable | Default | What it does |
|---|---|---|
| `SKRUM_ACTION_ITEM_REMINDERS` | `true` | Send the daily reminders of action items that are due soon or overdue. `false` turns them off for everyone |
| `SKRUM_ACTION_ITEM_REMINDER_TIME` | `08:00` | The hour they are sent, in `APP_TIMEZONE` |

## GIFs

| Variable | Default | What it does |
|---|---|---|
| `SKRUM_GIF_PROVIDER` | empty | `giphy` or `tenor`. Empty hides GIFs |
| `SKRUM_GIF_API_KEY` | empty | Your API key at that provider |
| `SKRUM_GIF_RATING` | `g` | The highest content rating shown: `g`, `pg`, `pg-13` or `r` |

Searches and images pass through Skrüm: browsers do not contact the provider.

## AI features

The AI features are hidden until the selected provider has its required configuration. Configure them in **Administration › AI** or with the environment variables below. Saved admin values override the environment per field. See [AI configuration](../../administration/ai/) for setup examples, secret handling and custom endpoints.

| Variable | Default | What it does |
|---|---|---|
| `SKRUM_LLM_PROVIDER` | empty | `anthropic`, `openai`, `openai-compatible`, `gemini`, `azure`, `bedrock`, `groq`, `xai`, `deepseek`, `mistral`, `ollama`, `openrouter`; see [AI configuration](../../administration/ai/) for base URLs and authentication |
| `SKRUM_LLM_API_KEY` | empty | Your API key; optional for Ollama, compatible servers and Bedrock using AWS credentials |
| `SKRUM_LLM_MODEL` | empty | The name of the model, as the provider writes it |
| `SKRUM_LLM_BASE_URL` | provider default | Custom API address; required for `openai-compatible` and `azure`. Ollama uses `http://host:11434` without `/v1`; native Bedrock ignores this field |
| `SKRUM_LLM_BEDROCK_REGION` | `us-east-1` | AWS region for native Bedrock, also editable in Administration |
| `SKRUM_LLM_BEDROCK_USE_DEFAULT_CREDENTIALS` | `false` | Use the AWS default credential chain, including IAM roles; environment-only |

Once they are set, the content of a board is sent to that provider when a facilitator drafts a survey from a prompt, when a participant asks for name suggestions for a group, and when a retrospective with the AI summary turned on is completed.

To get a key, see Anthropic's [API overview](https://platform.claude.com/docs/en/api/overview) or OpenAI's [API authentication](https://platform.openai.com/docs/api-reference/authentication).

## AI assistants

| Variable | Default | What it does |
|---|---|---|
| `SKRUM_MCP_ENABLED` | `true` | Serve the MCP server at `{APP_URL}/mcp`. See [Connect an assistant](../../mcp/connect/) |
| `SKRUM_MCP_RATE_LIMIT` | `120` | Requests per minute for each API token |
| `SKRUM_MCP_WRITE_RATE_LIMIT` | `30` | Calls that write or delete, per minute for each API token |

## Integrations

An integration is offered to teams when its values are set. Each page of the [Integrations](../../integrations/overview/) section says what to create at the provider.

| Integration | Variables |
|---|---|
| Slack | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` |
| Telegram | `TELEGRAM_BOT_TOKEN` |
| Microsoft Teams | `MSTEAMS_ENABLED` (default `false`), `MSTEAMS_ALLOWED_HOSTS` |
| Mattermost | `MATTERMOST_URL` |
| Jira Cloud | `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` |
| Jira Data Center | `JIRA_DC_BASE_URL`, `JIRA_DC_CLIENT_ID`, `JIRA_DC_CLIENT_SECRET`, `JIRA_DC_PERSONAL_TOKENS` (default `true`) |
| Linear | `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SECRET` |
| GitHub | `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_APP_WEBHOOK_SECRET` |
| Webhooks | `OUTGOING_WEBHOOKS_ENABLED` (default `false`) |

`GITHUB_APP_PRIVATE_KEY` holds the key itself, with `\n` in place of line breaks. `GITHUB_APP_PRIVATE_KEY_PATH` holds the path of a file in the container.

The tokens a team obtains when it connects are stored encrypted with `APP_KEY`. When you change `APP_KEY`, keep the old key in `APP_PREVIOUS_KEYS`, or every team must connect again.

### Inbound webhooks and polling

Jira, Linear and GitHub can tell Skrüm that an issue changed. That needs an instance they can reach.

| Variable | Default | What it does |
|---|---|---|
| `INTEGRATIONS_INBOUND_WEBHOOKS` | `auto` | `auto` accepts the providers' webhooks when `APP_URL` is an `https` address whose host resolves to a public address. `on` always accepts them. `off` never does |
| `INTEGRATIONS_POLL_MINUTES` | `5` | When webhooks are not accepted, the number of minutes between two reads of each tracker, from 1 to 60 |

Telegram is always read by polling, every minute.

### Outgoing webhooks

| Variable | Default | What it does |
|---|---|---|
| `OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS` | `false` | Let a team send webhooks to an address of a private network |
| `OUTGOING_WEBHOOKS_ALLOW_HTTP` | `false` | Let a team send webhooks to a plain `http` address |

## Realtime

| Variable | Default | What it does |
|---|---|---|
| `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET` | derived from `APP_KEY` | The credentials of the realtime server. Leave them empty unless you want to choose them |
| `REVERB_CLIENT_HOST`, `REVERB_CLIENT_PORT`, `REVERB_CLIENT_SCHEME` | empty | Where browsers open the websocket. Leave them empty: the browser uses the host and port of the page |
| `REVERB_ALLOWED_ORIGINS` | the host of `APP_URL` | The host names whose pages may open a websocket, separated by commas. `*` is accepted as a wildcard |
| `REVERB_MAX_REQUEST_SIZE` | `10000` | The largest message, in bytes. Do not lower it |
| `REVERB_SERVER_PORT` | `8080` | The port the realtime server listens on inside the container. The Compose files set it |

Live cursors send about 25 messages per second for each participant. If you turn on `REVERB_APP_RATE_LIMITING_ENABLED`, allow at least 25 messages for every second of the window: 1500 in `REVERB_APP_RATE_LIMIT_MAX_ATTEMPTS` for 60 in `REVERB_APP_RATE_LIMIT_DECAY_SECONDS`.

## Database

The Compose files set the engine, its host and its port. [Database](../database/) describes each engine.

| Variable | Default | What it does |
|---|---|---|
| `DB_CONNECTION` | set by the Compose file | `pgsql`, `mariadb`, `mysql` or `sqlite` |
| `DB_HOST`, `DB_PORT` | set by the Compose file | Where the database server answers |
| `DB_DATABASE` | `skrum` | The name of the database. With SQLite, the path of the file |
| `DB_USERNAME` | `skrum` | The database user |
| `DB_PASSWORD` | none | Its password |
