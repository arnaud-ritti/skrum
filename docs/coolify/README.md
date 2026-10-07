# Skrum on Coolify

The files Coolify asks of a one-click service, kept here until Skrum can be submitted upstream.

| File | What it is |
| --- | --- |
| `skrum.yaml` | The Compose template |
| `skrum.svg` | The logo |
| `skrum.mdx` | The page for Coolify's documentation |

## Deploy it today

The website documentation includes a [deployment guide](../../website/src/content/docs/self-hosting/coolify.md) covering the domain, mail, verification, backups and upgrades.

The image `ghcr.io/arnaud-ritti/skrum:0.0.1` must be published and public.

1. In Coolify, open a project and add a resource: **Docker Compose Empty**.
2. Paste the content of [`skrum.yaml`](skrum.yaml) and save.
3. Press **Deploy**. Coolify generates the domain, the application key and the database credentials.
4. Open the generated domain and sign up: the first account becomes the instance admin.

Email verification is required by default (`SKRUM_REQUIRE_EMAIL_VERIFICATION=true`). Set the service variable to `false` to make it optional. Administration › General › Email verification can override that value with **Required** or **Optional**; **Use environment default** clears the override. Redeploy after changing the service variable.

Daily update checks default to enabled (`SKRUM_UPDATE_CHECK_ENABLED=true`). Set the service variable to `false` and redeploy to change the default; a saved Administration › General setting takes precedence. Checks do not install updates.

To update, change the tag of the `skrum` image in the service's Compose file and deploy again. Migrations run when the container starts.

## Submitting upstream

Coolify accepts a service whose repository has at least 1,000 GitHub stars. Until then, nothing is submitted.

Two pull requests, opened together and linked to each other:

1. **Template**, against the `next` branch of [`coollabsio/coolify`](https://github.com/coollabsio/coolify):
    - `skrum.yaml` → `templates/compose/skrum.yaml`
    - `skrum.svg` → `svgs/skrum.svg`
    - tested from a fresh "Docker Compose Empty" resource
2. **Documentation**, against Coolify's documentation repository:
    - `skrum.mdx` → `content/docs/services/skrum.mdx`
    - `skrum.svg` → `public/images/services/skrum.svg`
    - then `bun run generate:services`

The template pull request cannot be merged before the documentation one is approved.

Contribution guide: <https://coolify.io/docs/contribute/service>.

## AI configuration

Choose the Laravel AI SDK text provider in **Administration › AI** or set `SKRUM_LLM_PROVIDER`: `anthropic`, `openai`, `openai-compatible`, `gemini`, `azure`, `bedrock`, `groq`, `xai`, `deepseek`, `mistral`, `ollama` or `openrouter`. Set `SKRUM_LLM_MODEL` and, for providers that require authentication, `SKRUM_LLM_API_KEY`. Admin fields override the corresponding environment value.

`openai-compatible` requires `SKRUM_LLM_BASE_URL`, usually ending in `/v1`, and allows a keyless server. Native `ollama` uses a URL such as `http://llm:11434` without `/v1`; a key is optional. Native `azure` requires the resource URL and uses the deployment name as the model. Existing `openai` configurations with a custom base URL retain Chat Completions.

Native `bedrock` uses the AWS SDK and Converse API, ignores the base URL and reads `SKRUM_LLM_BEDROCK_REGION` (default `us-east-1`, also editable in admin settings). Supply a Bedrock API key, or leave the effective API key empty and set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and, for temporary credentials, `AWS_SESSION_TOKEN`. To use an IAM role or the AWS default credential chain, enable `SKRUM_LLM_BEDROCK_USE_DEFAULT_CREDENTIALS=true` and leave explicit credentials empty. This infrastructure flag and AWS access credentials are environment-only. Redeploy after changing Coolify variables.

The website’s [AI configuration guide](../../website/src/content/docs/administration/ai.md) contains setup examples for each provider and the migration behavior.
