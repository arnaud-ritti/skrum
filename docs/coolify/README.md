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
