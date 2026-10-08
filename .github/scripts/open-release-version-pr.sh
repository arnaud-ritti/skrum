#!/usr/bin/env bash
set -euo pipefail
node .github/scripts/sync-release-version.mjs "$RELEASE_VERSION"
composer update --lock --no-install --no-scripts --no-interaction --ignore-platform-reqs
if git diff --quiet; then
    echo "Release references are already current."
    exit 0
fi
branch="chore/release-version-$RELEASE_VERSION"
git switch -c "$branch"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add compose.production*.yaml docs/coolify/skrum.yaml docs/coolify/README.md README.md .env.production.example config/skrum.php composer.json composer.lock website/src/snippets/install.sh website/src/content/docs/self-hosting
if ! git diff --cached --quiet -- README.md website; then
    echo "docs=true" >> "$GITHUB_OUTPUT"
fi
git commit -m "chore(release): sync references to $RELEASE_VERSION"
gh auth setup-git
if git ls-remote --exit-code --heads origin "$branch" > /dev/null; then
    git fetch origin "$branch:refs/remotes/origin/$branch"
fi
git push --force-with-lease origin "$branch"
body_file=$(mktemp)
trap 'rm -f "$body_file"' EXIT
printf 'Update Composer, the application version fallback and any explicitly versioned deployment references to release %s. Preserve latest image references.\n\nThe release image was published successfully before opening this pull request. The workflow validates this exact commit before automatically merging it to synchronize the repository. Existing installations keep their configured image until explicitly upgraded.\n' "$RELEASE_VERSION" > "$body_file"
existing_pr=$(gh pr list --head "$branch" --base "$DEFAULT_BRANCH" --state open --json number --jq '.[0].number // empty')
if [[ -n "$existing_pr" ]]; then
    gh pr edit "$existing_pr" --body-file "$body_file"
    pr_number=$existing_pr
else
    gh pr create --base "$DEFAULT_BRANCH" --head "$branch" --title "chore(release): sync references to $RELEASE_VERSION" --body-file "$body_file"
    pr_number=$(gh pr view "$branch" --json number --jq .number)
fi
echo "pr=$pr_number" >> "$GITHUB_OUTPUT"
echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
