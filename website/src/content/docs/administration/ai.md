---
title: "AI configuration"
description: "Configure Anthropic, OpenAI or a self-hosted language model in Administration or through environment variables."
order: 9
related:
  - self-hosting/configuration
  - self-hosting/coolify
  - surveys/create-a-survey
  - retrospectives/grouping
  - retrospectives/summary-and-sharing
---

Instance admins can configure the language model in **Administration › AI**. It powers survey drafts from a prompt, suggested names for card groups and retrospective summaries. These features stay hidden until the provider, API key and model are configured.

## Configure it in Administration

1. Open **Admin** in the sidebar and select **AI**.
2. Confirm your password if asked. Changes require confirmation within the last five minutes.
3. Set **Provider** to `anthropic` or `openai`, enter the **API key** and **Model**, and optionally set **Base URL**.
4. Select **Save**. The page shows **Configured** when all three required values are present; this means the configuration is complete, not that the credentials have been tested with the provider.

The API key is encrypted in the database and never sent back to the browser. Leave it blank to keep the existing key. Each saved field overrides its environment value independently. **Use the environment value** clears a saved field when you save; if the environment contains a value, that value becomes active again.

Changes are recorded in the audit log without the key. They apply to subsequent requests and jobs without a redeployment.

## Environment variables

| Variable | Required | Value |
|---|---|---|
| `SKRUM_LLM_PROVIDER` | Yes | `anthropic` or `openai` |
| `SKRUM_LLM_API_KEY` | Yes | API key for the selected provider or gateway |
| `SKRUM_LLM_MODEL` | Yes | Exact model identifier available to your account or server |
| `SKRUM_LLM_BASE_URL` | No | API base address; omit it to use the selected provider’s default |

Restart or redeploy after changing environment variables. A saved admin field still overrides the corresponding variable.

### Anthropic

```ini
SKRUM_LLM_PROVIDER=anthropic
SKRUM_LLM_API_KEY=your-anthropic-api-key
SKRUM_LLM_MODEL=your-anthropic-model-id
SKRUM_LLM_BASE_URL=
```

With no base URL, Skrüm uses `https://api.anthropic.com` and sends requests to `/v1/messages`. For an Anthropic-compatible gateway, set its base address without `/v1/messages`.

### OpenAI

```ini
SKRUM_LLM_PROVIDER=openai
SKRUM_LLM_API_KEY=your-openai-api-key
SKRUM_LLM_MODEL=your-openai-model-id
SKRUM_LLM_BASE_URL=
```

With no base URL, Skrüm uses `https://api.openai.com/v1` and sends requests to `/chat/completions`. Choose a model that supports that API and is available to your account.

### A self-hosted OpenAI-compatible server

```ini
SKRUM_LLM_PROVIDER=openai
SKRUM_LLM_API_KEY=your-server-api-key
SKRUM_LLM_MODEL=your-local-model-id
SKRUM_LLM_BASE_URL=http://llm:11434/v1
```

This example assumes the server is reachable as `llm` from the Skrüm container and implements the OpenAI-compatible chat completions API. Set the address, model and key to match your server. Skrüm requires a non-empty key even if the server does not authenticate requests; in that case, supply a non-empty placeholder accepted by the server.

Use HTTPS for a remote endpoint. HTTP is supported for a server on your internal network. `localhost` inside the Skrüm container refers to that container, not the Docker host or another service.

## Content sent to the provider

AI requests run on the server. The API key stays there. Survey drafting sends the prompt and survey instructions; group-name suggestions send the relevant cards; retrospective summaries send the summary input for that retrospective. Privacy notices identify the configured provider, or the hostname of a custom base URL.

## Disable AI

Clear the saved provider, API key or model and ensure the corresponding environment variable is empty. The features disappear when any required effective value is missing. Clearing a saved value alone does not disable AI if the environment supplies a replacement.

## Troubleshooting

- **Not configured:** check that the effective provider is supported and the key and model are non-empty.
- **Requests fail:** check the key, model access, endpoint and connectivity from the application container. A complete configuration does not prove the provider will accept it.
- **Wrong provider or endpoint:** check the source shown under each field. A saved value takes precedence over the environment.
- **Custom endpoint returns 404:** supply the base URL, not the full request path. Skrüm appends `/chat/completions` for `openai` or `/v1/messages` for `anthropic`.
