---
title: "Deploy with Coolify"
description: "Deploy Skrüm and PostgreSQL on Coolify, configure your domain and mail, and keep the instance backed up."
order: 7
related:
  - self-hosting/requirements
  - self-hosting/configuration
  - administration/general-and-branding
  - administration/mail
  - self-hosting/upgrading
---

Deploy the published Skrüm image as a **Docker Compose Empty** resource in Coolify. The project provides a [Coolify Compose template](https://github.com/arnaud-ritti/skrum/blob/main/docs/coolify/skrum.yaml) that starts the application and PostgreSQL together. You do not need to build the application or create a separate queue worker or scheduler.

## Before you start

You need a running Coolify instance with a connected Docker server, a project and environment for the resource, and a domain pointing to that server. See [Requirements](../requirements/) for supported machines and database versions.

Have SMTP credentials ready if members will verify their email. Verification is required by default; the template writes mail to the application log until you configure SMTP.

## Create the resource

1. Open your project and environment in Coolify and select **+ New**.
2. Choose **Docker Compose Empty** and select the destination server when asked.
3. Open the [template](https://github.com/arnaud-ritti/skrum/blob/main/docs/coolify/skrum.yaml), select **Raw**, and copy the whole YAML file.
4. Paste it into the resource's Compose editor and save.
5. Review the image tag of the `skrum` service. Use a published release tag from [the project's releases](https://github.com/arnaud-ritti/skrum/releases) for deployments you upgrade deliberately.

Coolify generates the application key and database credentials from the template's `SERVICE_*` variables. Keep these values across redeployments. The database service stays on the internal network.

The Compose definition is stored in Coolify. Changes to the template in GitHub do not automatically update this resource. Coolify's [Docker Compose documentation](https://coolify.io/docs/applications/builds/docker-compose) explains this deployment method and its environment variables.

## Set the public address

Open the `skrum` service's domain settings and set an HTTPS address, such as `https://skrum.example.com`. The application listens on **container port 80**; Coolify's proxy handles HTTPS. Leave the container's `SERVER_NAME` at its default, `:80`.

The template uses `SERVICE_URL_SKRUM_80` for routing and sets `APP_URL` from `SERVICE_URL_SKRUM`. Check that `APP_URL` resolves to the public HTTPS address after saving the domain. Skrüm uses it for verification links, invitations and sign-in callbacks.

Web pages and realtime connections use the same public address. Forward websocket connections through the proxy too; you do not need to expose the internal Reverb port, `8080`.

## Configure mail and verification

In the resource's **Environment Variables**, fill in the mail values before creating the first account:

```ini
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=skrum
MAIL_PASSWORD=your-password
MAIL_FROM_ADDRESS=skrum@example.com
SKRUM_REQUIRE_EMAIL_VERIFICATION=true
```

Use the host, port and credentials supplied by your mail provider. The [Mail guide](../../administration/mail/) explains encryption settings and how to send a test message from Administration.

To start without requiring email verification, set `SKRUM_REQUIRE_EMAIL_VERIFICATION=false` before deploying. This lets you create the admin account and configure SMTP from Administration. It does not enable mail delivery: invitations, password resets and other email features still need a working mail server.

Once signed in, **Administration › General › Email verification** offers **Required**, **Optional** and **Use environment default**. A saved admin choice overrides the environment variable; **Use environment default** clears the override. Redeploy after changing environment variables in Coolify.

## Deploy and create the admin account

1. Select **Deploy** and watch the deployment logs. PostgreSQL must become healthy before the application starts; Skrüm applies pending database migrations on startup.
2. Wait for the `skrum` service to become healthy, then open its public address.
3. Select **Create an account** and complete the form. If verification is required, follow the link in the verification email.

The first account becomes the instance admin. Create it immediately after deploying.

Afterwards, sign-up defaults to invitation only. Set `SKRUM_SIGNUP_MODE` to `open` or `domain` in Coolify, or change it in **Administration › General**. For domain mode, supply `SKRUM_ALLOWED_EMAIL_DOMAINS`. See [Configuration reference](../configuration/) for these and the optional SSO, GIF and integration settings.

## Configure AI

Open **Administration › AI** to set the provider, API key, model and optional base URL, or fill `SKRUM_LLM_PROVIDER`, `SKRUM_LLM_API_KEY`, `SKRUM_LLM_MODEL` and `SKRUM_LLM_BASE_URL` in Coolify’s environment variables and redeploy. Use `anthropic` for Anthropic or `openai` for OpenAI-compatible APIs. Saved admin fields override the environment. See [AI configuration](../../administration/ai/) for examples and custom endpoints.

## Back up and upgrade

Back up the database and uploaded files together:

| Template volume | Contents |
|---|---|
| `skrum-postgres` | PostgreSQL data, mounted at `/var/lib/postgresql` |
| `skrum-storage` | Uploaded files, mounted at `/app/storage/app` |

Use a PostgreSQL-aware database backup and preserve the storage volume. Keep the application key with your deployment secrets so encrypted settings remain readable after a restore. Check that your backup can be restored before relying on it.

Daily update checks are enabled by default (`SKRUM_UPDATE_CHECK_ENABLED=true`). Set this variable to `false` in Coolify and redeploy to change the default, or use **Administration › General › Updates**. A saved admin choice takes precedence. Checks report available versions; they do not install them.

To upgrade, back up first, open **Edit Compose File**, change the `skrum` image tag to the desired release, save, and deploy again. Keep the existing credentials and volumes. Migrations run on startup. See [Upgrading](../upgrading/) for migration and rollback considerations; its shell commands target the standalone Compose installation.

## Troubleshooting

| Symptom | What to check |
|---|---|
| The application keeps restarting | Read the `skrum` and `postgres` service logs. Check database health, credentials and image availability |
| The public address gives a proxy error | Check DNS, the service domain and routing to container port 80 |
| Verification mail never arrives | Check that `MAIL_MAILER=smtp`, inspect the application logs, and check your SMTP credentials. With `log`, no mail is delivered |
| Email links use the wrong address | Check the domain and the resolved `APP_URL`, then redeploy |
| Realtime updates do not arrive | Check that your proxy forwards websocket connections on the public domain |
| An environment change has no effect | Redeploy the resource and check whether a saved Administration setting overrides the variable |
