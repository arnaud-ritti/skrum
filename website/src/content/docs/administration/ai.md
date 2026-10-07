---
title: "AI configuration"
description: "Configure Anthropic, OpenAI, Mistral, Gemini, Ollama, Bedrock or an OpenAI-compatible endpoint."
order: 9
related:
  - self-hosting/configuration
  - self-hosting/coolify
  - surveys/create-a-survey
  - retrospectives/grouping
  - retrospectives/roti-and-close
  - retrospectives/actions
  - retrospectives/summary-and-sharing
---

Instance admins can configure the language model in **Administration › AI**. It powers survey drafts from a prompt, suggested names for card groups and retrospective summaries. Skrüm uses Laravel AI SDK for text generation. These features stay hidden until the selected provider has its required configuration.

## Configure it in Administration

1. Open **Admin** in the sidebar and select **AI**.
2. Confirm your password if asked. Changes require confirmation within the last five minutes.
3. Choose **Provider**, enter **Model** and the provider’s **API key** if required, and set **Base URL** for a custom endpoint. For Bedrock, also choose **AWS region**.
4. Select **Save**. The page shows **Configured** when the selected provider’s required values are present; this means the configuration is complete, not that the credentials have been tested with the provider.

The API key is encrypted in the database and never sent back to the browser. Leave it blank to keep the existing key. Each saved field overrides its environment value independently. **Use the environment value** clears a saved field when you save; if the environment contains a value, that value becomes active again.

Changes are recorded in the audit log without the key. They apply to subsequent requests and jobs without a redeployment.

## Environment variables

| Variable | Default | Value |
|---|---|---|
| `SKRUM_LLM_PROVIDER` | empty | A provider identifier from the table below; empty disables AI |
| `SKRUM_LLM_API_KEY` | empty | API key; optional for Ollama, OpenAI-compatible servers and Bedrock using AWS credentials |
| `SKRUM_LLM_MODEL` | empty | Exact model identifier; for Azure, use the deployment name |
| `SKRUM_LLM_BASE_URL` | provider default | Custom API base address; required for `openai-compatible` and `azure` |
| `SKRUM_LLM_BEDROCK_REGION` | `us-east-1` | Bedrock AWS region; also editable in Administration |
| `SKRUM_LLM_BEDROCK_USE_DEFAULT_CREDENTIALS` | `false` | Enable the AWS default credential chain, including IAM roles; environment-only |

Restart or redeploy after changing environment variables. A saved admin field still overrides the corresponding variable. Skrüm uses the `SKRUM_LLM_*` values for its AI features, rather than separate SDK keys such as `GEMINI_API_KEY` or `MISTRAL_API_KEY`.

### Supported providers

All these identifiers can be selected in Administration or used in `SKRUM_LLM_PROVIDER`. They use Laravel AI SDK’s text providers. Skrüm currently uses text generation for survey drafts, group names and summaries.

| Provider identifier | Service | Base URL and authentication |
|---|---|---|
| `anthropic` | Anthropic | API key; default endpoint. Existing gateway URLs without `/v1` are accepted |
| `openai` | OpenAI | API key; the default endpoint uses the Responses API. Existing configurations with a custom base URL retain Chat Completions |
| `openai-compatible` | LM Studio, vLLM, gateways and other compatible servers | Base URL required, usually `https://host/v1`; API key optional |
| `gemini` | Google Gemini | Gemini API key; native SDK endpoint, not the OpenAI compatibility endpoint |
| `azure` | Azure OpenAI | API key and resource base URL, e.g. `https://RESOURCE.openai.azure.com`; use the deployment name as Model |
| `bedrock` | Amazon Bedrock | Bedrock API key or AWS credentials; region required, no base URL |
| `groq` | Groq | Groq API key; provider default endpoint |
| `xai` | xAI | xAI API key; provider default endpoint |
| `deepseek` | DeepSeek | DeepSeek API key; provider default endpoint |
| `mistral` | Mistral | Mistral API key; provider default endpoint |
| `ollama` | Ollama | Native server URL, e.g. `http://llm:11434`, without `/v1`; API key optional |
| `openrouter` | OpenRouter | OpenRouter API key; provider default endpoint |

Choose a model available to your account or server that can follow the JSON instructions used by Skrüm’s AI features. The SDK handles each provider’s request and response format. See [Laravel AI SDK provider support](https://laravel.com/framework/docs/ai-sdk#provider-support).

### Anthropic or OpenAI

```ini
SKRUM_LLM_PROVIDER=anthropic
SKRUM_LLM_API_KEY=your-anthropic-api-key
SKRUM_LLM_MODEL=your-anthropic-model-id
SKRUM_LLM_BASE_URL=
```

For OpenAI, use `openai` and your OpenAI key and model. Leave the base URL empty to use the provider’s default endpoint.

### Mistral or Gemini

```ini
SKRUM_LLM_PROVIDER=mistral
SKRUM_LLM_API_KEY=your-mistral-api-key
SKRUM_LLM_MODEL=your-mistral-chat-model-id
SKRUM_LLM_BASE_URL=
```

For Gemini, use `gemini` and your Gemini key and model. Both providers have a built-in endpoint; a custom base URL is optional. Existing configurations using `openai` and a Mistral or Gemini compatibility URL continue to use Chat Completions. Keep those values to retain that API, or switch to the named provider and clear the old base URL to use the native SDK provider.

### Ollama

```ini
SKRUM_LLM_PROVIDER=ollama
SKRUM_LLM_API_KEY=
SKRUM_LLM_MODEL=your-installed-model-id
SKRUM_LLM_BASE_URL=http://llm:11434
```

The native Ollama provider uses `/api/chat`. With no custom base URL, the SDK defaults to `http://localhost:11434`. In Docker or Coolify, set the address reachable from the Skrüm container: `localhost` refers to that container, not another service or the Docker host. Set an API key if your Ollama server requires authentication.

### OpenAI-compatible servers

```ini
SKRUM_LLM_PROVIDER=openai-compatible
SKRUM_LLM_API_KEY=
SKRUM_LLM_MODEL=your-local-model-id
SKRUM_LLM_BASE_URL=http://llm:8000/v1
```

Set the API key if the server requires one. Skrüm appends `/chat/completions`, so do not include it in the base URL. Use HTTPS for a remote endpoint; HTTP is supported for internal services. Existing `openai` configurations with a custom base URL keep this same Chat Completions behavior after the SDK migration.

### Amazon Bedrock

Skrüm includes the AWS SDK required by Laravel AI SDK’s native Bedrock provider. It uses the Converse API and supports AWS authentication; it does not require an OpenAI-compatible Bedrock endpoint.

```ini
SKRUM_LLM_PROVIDER=bedrock
SKRUM_LLM_API_KEY=your-bedrock-api-key
SKRUM_LLM_MODEL=your-bedrock-model-or-inference-profile-id
SKRUM_LLM_BASE_URL=
SKRUM_LLM_BEDROCK_REGION=eu-west-3
```

Admins can update the Bedrock API key, model and region in **Administration › AI**. The base URL is ignored by native Bedrock. Choose a model or inference profile that supports Converse in the selected region.

For AWS access credentials, leave the effective `SKRUM_LLM_API_KEY` empty and supply `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in the deployment environment. Temporary credentials also need `AWS_SESSION_TOKEN`. These infrastructure credentials stay in the environment rather than admin settings. A saved or environment Bedrock API key takes precedence over AWS credentials.

For an IAM role or another source in the AWS default credential chain, set `SKRUM_LLM_BEDROCK_USE_DEFAULT_CREDENTIALS=true` and leave both the effective API key and explicit AWS access credentials empty. This flag is environment-only and disabled by default. The **Configured** indicator checks configuration, not whether AWS can resolve credentials or authorize a request.

For a Bedrock gateway exposing Chat Completions, use `openai-compatible` instead, with that gateway’s URL and authentication. See [Bedrock Converse](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html).

### Azure OpenAI

```ini
SKRUM_LLM_PROVIDER=azure
SKRUM_LLM_API_KEY=your-azure-api-key
SKRUM_LLM_MODEL=your-deployment-name
SKRUM_LLM_BASE_URL=https://RESOURCE.openai.azure.com
```

Supply the resource URL without `/openai/v1` or a request path; the SDK appends the API path.

## Where AI is used

| Place | How it starts | Review and control |
|---|---|---|
| [Quick polls inside a retro](../../retrospectives/roti-and-close/#draft-a-quick-poll-with-ai) | The facilitator selects **Generate from a prompt** | Review and edit the question before creating the poll |
| [Group names](../../retrospectives/grouping/#let-a-language-model-suggest-names) | A participant selects **Suggest group names**, with Automatic AI summary enabled | Suggestions stay private until accepted or edited |
| [Completed retro summary, themes and card labels](../../retrospectives/summary-and-sharing/#the-summary-with-a-language-model) | Automatically at completion if enabled, or manually by the facilitator | The facilitator can regenerate, remove or retry |
| [Suggested actions](../../retrospectives/actions/#suggested-actions) | Returned by the summary request | Review, promote into an action item, or reject |

The feature pages explain who can use each control, what is sent and what happens on failure. The provider settings are shared by these features. Standalone team surveys do not have the poll-drafting control.

## Content sent to the provider

AI requests run on the server. The API key stays there. Survey drafting sends the prompt, retro title, answer type and instructions; group-name suggestions send the retro title, column names and relevant cards; retrospective summaries send board content, topic notes, action items and survey/health/ROTI results within the request budget. Suggested actions, themes and card labels are part of that same summary request. Privacy notices identify the configured provider, or the hostname of a custom base URL.

## Disable AI

Clear the saved provider or model and ensure the corresponding environment variable is empty. Clearing only the API key does not disable providers that allow keyless servers or AWS credentials. Clearing a saved value alone does not disable AI if the environment supplies a replacement.

## Troubleshooting

- **Not configured:** check the selected provider’s requirements in the table. The model is always required; compatible servers and Azure require a base URL.
- **Requests fail:** check the key, model access, endpoint and connectivity from the application container. A complete configuration does not prove the provider will accept it.
- **Wrong provider or endpoint:** check the source shown under each field. A saved value takes precedence over the environment.
- **Custom endpoint returns 404:** supply the base URL, not the full request path. The path depends on the selected provider: compatible servers use `/chat/completions`, Ollama uses `/api/chat`, and native providers use the SDK’s API paths.
