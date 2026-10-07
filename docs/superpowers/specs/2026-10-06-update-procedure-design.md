# Skrum — Update procedure in Administration, and the end of the maintenance message — Design

Date: 2026-10-06
Status: **draft, awaiting the owner's review.** The owner answered six questions in conversation on 2026-10-06; §2 lists the answers the body is written on.
Database rules: `docs/database.md`, "Rules for database code".

What was read: `updates-card.tsx`, `maintenance-message-card.tsx`, `general-settings-form.tsx`, `admin-shell.tsx` (the version line), `pages/admin/mcp-keys.tsx`, `lib/admin/types.ts`, `GeneralSettingsController`, `GeneralSettingsUpdateRequest`, `UpdateChecksController`, `CheckForUpdate`, `InstanceVersion`, `InstanceSettings`, `InstanceSettingKey`, `MaintenanceDetails`, `AddMaintenanceDetailsListener`, `errors/503.blade.php`, `audit-action-label.tsx`, `ConfigurationCatalogue`, `config/skrum.php`, the README sections "Run with Docker" and "Upgrading", `docs/design-system/components/ScreenErrors/README.md`. Nothing was run.

## 1. Problem statement

Administration › General tells an admin "v0.0.2 is available" and stops there. How to update is in the README only, which an admin reading that line does not have open, and it covers Docker Compose alone.

The same page shows one command, on the maintenance-message card: "Shown on the maintenance page from the next `artisan down`." It cannot be run as written: the command is `php artisan down --retry=<seconds>`, inside the application container.

An audit of everything else the interface names found no fault: the 41 variable names of `ConfigurationCatalogue` ("From the environment (`MAIL_HOST`)") and `SKRUM_MCP_ENABLED` on the MCP keys page are all read by `config/*.php` and listed in `.env.example`. One thing is missing: the MCP page does not say that changing the variable needs a restart, which the README does.

## 2. The owner's answers

1. The procedure lives in the existing Updates card, always present: closed when the instance is up to date, open when a newer version is known.
2. Three tabs, Docker Compose, Coolify and From source. The admin picks; nothing is detected.
3. The maintenance-message card is removed, with the whole message feature behind it.
4. The procedure does not mention maintenance mode.
5. Three additions: a restart note on the MCP keys page, a link to the release notes, and a backup step that opens each procedure.

## 3. Goals

1. An admin who learns that a version is available can update without leaving the page: steps for their kind of install, with commands to copy that already name the new version.
2. The same admin reaches the release notes of that version in one click, from the card and from the version line of the admin sidebar.
3. No setting, page or line of code remains for a maintenance message. `php artisan down --retry=…` still shows the maintenance page with its time of return.
4. Every string is in English, French, Spanish and German, informal register.

## 4. Non-goals

- Updating from the interface (a button that pulls and restarts). The app does not control its container.
- Guessing the kind of install.
- A changelog shown in the app. The link goes to GitHub.
- Editing the mockups. `ScreenErrors` draws the admin's message on the 503 page; the owner's word of 2026-10-06 overrides it, and the deviation is recorded here.
- The 41 "From the environment" hints: audited, correct, untouched.

## 5. Design

### 5.1 What the server sends

`InstanceVersion::status()` gains `releaseUrl`: `<skrum.repository_url>/releases/tag/v<latest>` when the state is `outdated`, null otherwise. It reaches the Updates card and the sidebar's version line through the props they already receive.

`config/skrum.php` gains `image`, `ghcr.io/arnaud-ritti/skrum`, a literal beside `repository_url`. `GeneralSettingsController::edit` passes it as `image`.

### 5.2 The Updates card

Below the line of the last check:

- when the state is `outdated`, a link "Release notes" to `releaseUrl`, opened in a new tab;
- a disclosure "How to update" (`ui/collapsible`), open by default when the state is `outdated`, closed otherwise. It holds three tabs (`ui/tabs`): "Docker Compose", "Coolify", "From source". The first is selected.

Each tab is an ordered list. A command sits in a code block with a "Copy" button, built as the existing ones are (`settings/api-tokens/server-url.tsx`). Where a command names a version, it is the latest one when the state is `outdated`, and the placeholder `<version>` otherwise. Commands are not translated; the sentences around them are.

**Docker Compose**

1. Back up the database and the `app-storage` volume.
2. If `SKRUM_IMAGE` pins a version in your `.env`, set it to the new one: `SKRUM_IMAGE=<image>:<version>`.
3. Pull the image and recreate the containers, with your own Compose file if it has another name: `docker compose -f compose.production.yaml pull && docker compose -f compose.production.yaml up -d`.
4. Migrations run by themselves when the container starts. Reload this page: the version above is the new one.

**Coolify**

1. Back up the database and the storage volume.
2. In the service, edit the Compose file and set the image to `<image>:<version>`.
3. Press "Deploy". Migrations run by themselves when the container starts.
4. Reload this page: the version above is the new one.

**From source**

1. Back up the database and the `storage/app` directory.
2. Fetch the new version: `git fetch --tags && git checkout v<version>`.
3. Install the dependencies and build the interface: `composer install --no-dev --optimize-autoloader && npm ci && npm run build`.
4. Run the migrations and rebuild the caches: `php artisan migrate --force && php artisan optimize`.
5. Restart the web server, the queue worker, Reverb and the scheduler.

An install from source reads its version from the default of `SKRUM_VERSION` in `config/skrum.php`; a release that forgets to raise it leaves such an install showing the old number. That is a release chore, outside this spec.

### 5.3 The sidebar's version line

"update available: v0.0.2" becomes a link to `releaseUrl`, new tab. The text and the warning colour do not change.

### 5.4 The MCP keys page

"The MCP server is off (:env)." becomes "The MCP server is off (:env). Restart the instance after changing it."

### 5.5 Removing the maintenance message

Removed:

- `maintenance-message-card.tsx` and its test; the `maintenance_message` field of `general-settings-form.tsx`; the three `maintenanceMessage*` props of `GeneralSettingsPageProps` and of `GeneralSettingsController::edit`, with the controller's two private methods that feed them and its handling of the submitted message;
- the `maintenance_message` rule of `GeneralSettingsUpdateRequest`;
- `InstanceSettingKey::MaintenanceMessage` and `MaintenanceMessageBy`, `InstanceSettings::maintenanceMessage()`, `maintenanceMessageBy()`, `MaintenanceMessageMaxLength` and their two entries in `all()`;
- `message` and `author` in `MaintenanceDetails` (written and read), and the message block of `errors/503.blade.php` with its styles;
- the translations no line uses any more, in the four languages;
- in README "Upgrading", the half sentence about "the maintenance message saved in Administration › General".

Kept:

- `MaintenanceDetails`, its listener and `backAt`: the 503 page still shows the time of return taken from `--retry`;
- the `maintenance_message` label and the `maintenance_message_by` following key of `audit-action-label.tsx`: audit entries written before the removal must still read "Maintenance message", not a raw key.

No migration. Rule 5 of `docs/database.md` keeps migrations to the Schema builder, one per table, and the project has no data migration. The rows `maintenance_message` and `maintenance_message_by` that an earlier build stored stay in `instance_settings` and are read by nothing: `InstanceSettings` reads a row through an `InstanceSettingKey` case, and both cases are gone. The same holds for a maintenance payload written before the upgrade: its `message` and `author` are ignored.

Tests follow the code: those that cover the message are deleted or cut down to what remains (`MaintenanceDetailsTest` keeps `backAt`; `GeneralSettingsTest`, `ErrorPagesTest`, `InstanceSettingsTest`, the administration walkthrough and the visual test lose their message cases). The owner's answer 3 is the approval the project asks for before a test is deleted. The visual snapshots of Administration › General and of the 503 maintenance page are taken again.

## 6. Acceptance criteria

- **AC1.** With a newer version known, Administration › General shows "How to update" open, a "Release notes" link to `…/releases/tag/v<latest>`, and the Docker Compose tab selected.
- **AC2.** Up to date, never checked, or on a build that is not a release: "How to update" is present and closed, and there is no "Release notes" link.
- **AC3.** Each of the three tabs shows its steps of §5.2, the first being the backup. With a newer version known, the commands that name a version carry it (`SKRUM_IMAGE=ghcr.io/arnaud-ritti/skrum:0.0.2`, `git checkout v0.0.2`); otherwise they carry `<version>`.
- **AC4.** "Copy" puts the exact command on the clipboard, and the tabs and the disclosure work with the keyboard alone.
- **AC5.** In the admin sidebar, "update available: v<latest>" is a link to the same release.
- **AC6.** The MCP keys page, with the server off, shows the sentence of §5.4.
- **AC7.** Administration › General has no maintenance-message card; a `PUT` carrying `maintenance_message` stores nothing under that key.
- **AC8.** After `php artisan down --retry=1800`, the 503 page shows the time of return and no message block, on an instance whose `instance_settings` still holds a `maintenance_message` row from an earlier build.
- **AC9.** A maintenance payload written by an earlier build, carrying `message` and `author`, yields the time of return alone.
- **AC10.** An audit entry recorded before the upgrade for a change of the maintenance message still reads "Maintenance message".
- **AC11.** Every new sentence exists in `lang/en.json`, `fr.json`, `es.json` and `de.json`; no translation key of the removed feature remains unless another line uses it.
- **AC12.** `composer ci:check` passes, and the visual snapshots of Administration › General and the 503 maintenance page are regenerated.
