# Skrum on Coolify

The files Coolify asks of a one-click service, kept here until Skrum can be submitted upstream.

| File | What it is |
| --- | --- |
| `skrum.yaml` | The Compose template |
| `skrum.svg` | The logo |
| `skrum.mdx` | The page for Coolify's documentation |

## Deploy it today

The website documentation includes a [deployment guide](../../website/src/content/docs/self-hosting/coolify.md) covering the domain, mail, verification, backups and upgrades.

The template uses the public image `ghcr.io/arnaud-ritti/skrum:latest`. Pull and redeploy to update it, or choose an explicit release tag to control upgrades.

Publish a stable GitHub release from a commit merged into the default branch. **Docker image** builds from the release tag and synchronizes the image's Composer metadata, lock file and application version fallback with that version before building. It preserves `latest` references. Only the latest stable release publishes the `latest` image tag; prereleases keep their own version tags. Creating a tag alone does not publish an image.

After the image is published successfully, **Sync release version** opens a pull request to update the repository's Composer metadata, lock file, application fallback and any explicitly versioned deployment references. It runs the full CI and documentation checks directly against that PR's exact commit, then automatically squash-merges that same commit and deletes its branch. No manual version PR or approval is required for this validation run. If validation fails or repository protection blocks merging, the PR remains open. When documentation references change, the workflow triggers the documentation deployment after merging.

**Sync release version** can also be run manually to retry synchronization for the latest published stable release; an empty version input selects it automatically. Older releases cannot replace the repository's current defaults. An already synchronized repository produces no PR.

Repository maintainers must enable **Allow GitHub Actions to create and approve pull requests** under **Settings → Actions → General → Workflow permissions**, and allow squash merges. The workflow validates and merges its own version PR; it does not approve reviews or bypass branch protection. GitHub may separately offer approval for the ordinary PR-triggered checks; the release workflow invokes its validation directly, so those additional runs are not needed for this flow.

To republish a removed version, merge the workflow changes first, then recreate the release tag from that merged commit. Rerunning an older tag uses the workflow stored at that older commit.

1. In Coolify, open a project and add a resource: **Docker Compose Empty**.
2. Paste the content of [`skrum.yaml`](skrum.yaml) and save.
3. Press **Deploy**. Coolify generates the domain, the application key and the database credentials.
4. Open the generated domain and sign up: the first account becomes the instance admin.

Email verification is required by default (`SKRUM_REQUIRE_EMAIL_VERIFICATION=true`). Set the service variable to `false` to make it optional. Administration › General › Email verification can override that value with **Required** or **Optional**; **Use environment default** clears the override. Redeploy after changing the service variable.

Daily update checks default to enabled (`SKRUM_UPDATE_CHECK_ENABLED=true`). Set the service variable to `false` and redeploy to change the default; a saved Administration › General setting takes precedence. Checks do not install updates.

To update with `latest`, pull the image and deploy again. If you pinned a release, change the tag of the `skrum` image in the service's Compose file before deploying. Migrations run when the container starts.

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
