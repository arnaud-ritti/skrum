---
title: "AI configuration"
description: "Configure Anthropic, OpenAI, Mistral, Gemini, Ollama, Bedrock or an OpenAI-compatible endpoint."
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

### Ollama and other self-hosted OpenAI-compatible servers

```ini
SKRUM_LLM_PROVIDER=openai
SKRUM_LLM_API_KEY=your-server-api-key
SKRUM_LLM_MODEL=your-local-model-id
SKRUM_LLM_BASE_URL=http://llm:11434/v1
```

This example assumes the server is reachable as `llm` from the Skrüm container and implements the OpenAI-compatible chat completions API. Set the address, model and key to match your server. Skrüm requires a non-empty key even if the server does not authenticate requests; in that case, supply a non-empty placeholder accepted by the server.

Use HTTPS for a remote endpoint. HTTP is supported for a server on your internal network. `localhost` inside the Skrüm container refers to that container, not the Docker host or another service.

### Mistral, Gemini and Amazon Bedrock

For these services, select **Provider** `openai`: this selects the request format, not the company receiving the request. Set the service’s **API key**, **Model** and **Base URL** in Administration, or use the same four environment variables.

| Service | `SKRUM_LLM_BASE_URL` | Key and model |
|---|---|---|
| Mistral | `https://api.mistral.ai/v1` | Mistral API key and a chat model available to your account |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | Gemini API key and a model supporting its OpenAI compatibility API |
| Ollama | `http://llm:11434/v1` | A non-empty placeholder such as `ollama` for a local server without authentication, and a model installed on that server |
| Amazon Bedrock | `https://bedrock-runtime.REGION.amazonaws.com/openai/v1` | Bedrock API key and a model supporting Chat Completions in that region |
| Other OpenAI-compatible endpoint | The server’s API base URL, usually ending in `/v1` | Its bearer API key and model identifier |

Replace `REGION` with your AWS region. The base URL must exclude `/chat/completions`; Skrüm appends that path. Select models that return text in `choices[0].message.content` and can follow the JSON instructions used by Skrüm’s AI features.

For example, Mistral:

```ini
SKRUM_LLM_PROVIDER=openai
SKRUM_LLM_API_KEY=your-mistral-api-key
SKRUM_LLM_MODEL=your-mistral-chat-model-id
SKRUM_LLM_BASE_URL=https://api.mistral.ai/v1
```

For Gemini, replace the key, model and base URL with the Gemini values in the table. For Bedrock, use a **Bedrock API key**, not an AWS access-key ID or secret. Skrüm sends bearer authentication and does not sign AWS SigV4 requests or call the native Converse API. If your AWS setup requires SigV4 or a model is unavailable through Chat Completions, use an OpenAI-compatible gateway that handles AWS authentication and model routing.

These configurations use each service’s compatibility API; Skrüm does not implement their additional native API features. Provider-specific guidance: [Mistral migration guide](https://docs.mistral.ai/resources/migration-guides), [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai), [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), and [Bedrock Chat Completions](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-chat-completions.html).

## Content sent to the provider

AI requests run on the server. The API key stays there. Survey drafting sends the prompt and survey instructions; group-name suggestions send the relevant cards; retrospective summaries send the summary input for that retrospective. Privacy notices identify the configured provider, or the hostname of a custom base URL.

## Disable AI

Clear the saved provider, API key or model and ensure the corresponding environment variable is empty. The features disappear when any required effective value is missing. Clearing a saved value alone does not disable AI if the environment supplies a replacement.

## Troubleshooting

- **Not configured:** check that the effective provider is supported and the key and model are non-empty.
- **Requests fail:** check the key, model access, endpoint and connectivity from the application container. A complete configuration does not prove the provider will accept it.
- **Wrong provider or endpoint:** check the source shown under each field. A saved value takes precedence over the environment.
- **Custom endpoint returns 404:** supply the base URL, not the full request path. Skrüm appends `/chat/completions` for `openai` or `/v1/messages` for `anthropic`.
