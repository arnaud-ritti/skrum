# Front-end Rewrite — White-label and Instance Admin (Plan 18d) Implementation Plan

> **For agentic workers:** back-end tasks run in sequence, one agent each, with a review after each. Front tasks run after them. There is no code in this plan: the spec, the design-system files and the existing code are the references. Every agent reads **Global Constraints** and **Security rules** below.

**Goal:** An instance admin rebrands the application (colour, logos, favicon, radius, name, "Powered by Skrüm", avatar style, GIF provider) from an Admin area, without being able to break accessibility, and manages who is an instance admin.

**Architecture:** One `instance_settings` key–value table read through a cached `InstanceSettings` service; environment variables stay as defaults when no setting is stored. `BrandPalette` derives a contrast-safe palette from the chosen colour and its CSS is injected after the stylesheet. The Admin area is the first real page on the new layouts (`AppLayout` + `SettingsLayout` sub-navigation).

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5, Inertia 3, React 19, Tailwind 4, the `ui/` and `skrum/` components of plan 18b+18c.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — row 18d of §12; B4, B5, B6, B7 of §9; §5; §6.3. Design: `docs/design-system/sections/05-white-label.md`, `docs/design-system/php/BrandPalette.php`, `components/ScreenSettings/README.md` and `preview.html` (frame b, instance admin), `components/AvatarStylePicker/README.md`, `components/GifPicker/README.md` (admin settings part).

**Not in this plan:** SSO, SMTP, integrations, MCP keys, licence, users, audit log admin sections (spec §10 backlog); e-mails (18f); rewriting any existing page (18e).

## Autonomous run

Unattended, as the owner asked (2026-10-01). Branch `plan-18d-branding` from the head of `plan-18bc-components`. No merge into `main`, no push. No new package, PHP or JS. Every decision taken on the owner's behalf goes in the ledger and the phase report.

## Global Constraints

- All constraints of plan 18b+18c apply to front files (tokens only, rem, no arbitrary size, truncate, focus ring, lucide, presentational `skrum/` components, literal `t()` keys in four languages, no `sk-*`).
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have an `up` method only.
- Controllers are plural and stick to CRUD method names; non-CRUD actions get their own controller. Route names camelCase, URLs kebab-case. Form Requests with array rules. Policies for authorisation.
- PHP style: early returns, no `else`, typed everything, PascalCase constants, no comments restating code, Pint, Rector-clean. Arch suite stays green.
- Environment variables keep working as defaults: `SKRUM_AVATAR_STYLE`, `SKRUM_GIF_PROVIDER`, `SKRUM_GIF_API_KEY`, `SKRUM_GIF_RATING`, `APP_NAME`. A stored setting wins; clearing it returns to the env default.
- The Pest browser suite is a contract; no existing page changes look or behaviour when no setting is stored, except the default GIF rating (`g`).
- Gates use `bin/test-browser` and `vendor/bin/sail artisan test --parallel --processes=8 --compact`; never `--tia`.

## Security rules

1. Every Admin route sits behind `auth`, `verified`, password confirmation where Fortify applies it to sensitive settings, and a policy or gate that requires `is_instance_admin`. A non-admin gets 403, a guest is redirected to login; tested per route.
2. The last instance admin cannot be revoked, including by themselves; tested, including two concurrent revocations (lock or atomic check).
3. Uploads (logos light and dark, favicon): PNG, JPEG, WebP or SVG; 512 KB maximum; MIME checked from content, not only extension; stored on a non-public disk under a generated name; served by a controller with `Content-Type` from the stored type, `X-Content-Type-Options: nosniff`, and for SVG `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`. SVG is only ever shown through `<img>`, never inlined. Tested with an SVG containing a script and an `onload` attribute (served with the CSP, not executed inline anywhere in a page).
4. The GIF API key is stored with Laravel's `encrypted` casting or `Crypt`, never sent to the browser, never logged; the admin page receives only `hasKey: boolean`. Tested by asserting the key is absent from the Inertia props and the HTML.
5. The brand colour is validated as a 3- or 6-digit hex before it reaches `BrandPalette`; the generated CSS contains only numbers produced by the class (no user string is interpolated); the display name is escaped everywhere it is rendered, including the `<title>`. Tested with a name containing `</title><script>`.
6. Radius is an integer clamped to 0–16.
7. State-changing requests are POST/PUT/PATCH/DELETE with CSRF; no setting changes on GET.

## Review Focus

1. **A non-admin or a guest reaches an Admin URL or posts to it** — 403 or login redirect, for every route. Pinned per route in feature tests.
2. **A hostile upload** (SVG with script, a PHP file renamed `.png`, a 5 MB image) — rejected or served inert. Pinned in the upload tests.
3. **A brand colour that cannot carry text** (`#FFD600`, `#777777`, `#0a0a0a`) — contrast holds in both themes and the admin sees the entered value, the applied value and a warning. Pinned in `BrandPaletteTest` and the Branding page test.
4. **Settings cleared or never set** — the application looks and behaves as before this plan. Pinned by the full browser suite and a test that renders `app.blade.php` with no setting.
5. **Stale cache** — after an admin saves, the next request of another user shows the new brand. Pinned by a feature test that saves then reads through a fresh request.

---

## Back-end tasks (sequential)

### Task 1: Instance settings store

- [ ] Migration `instance_settings` (`id` uuid, `key` unique string, `value` json nullable, timestamps); model; factory.
- [ ] `App\Support\InstanceSettings` service: typed getters with env/config fallbacks for `brand_color`, `brand_radius`, `display_name`, `powered_by`, `logo_light`, `logo_dark`, `favicon`, `avatar_style`, `avatar_member_choice`, `gif_provider`, `gif_enabled`, `gif_rating`, `gif_key` (encrypted); `set`, `forget`; cached under one key, invalidated on write.
- [ ] Tests: fallback to config when unset; stored value wins; forget returns to default; cache invalidation; encrypted key round-trip and absence from `toArray`.

### Task 2: BrandPalette

- [ ] `app/Support/Branding/BrandPalette.php` from `docs/design-system/php/BrandPalette.php`, adapted to the project's PHP rules (no `final`/`readonly` by default, typed, docblocks for array shapes), plus `toHex()` returning sRGB hex strings for both themes (for e-mails, plan 18f).
- [ ] `BrandPaletteTest`: for `#FFD600`, `#22c55e`, `#777777`, `#0a0a0a`, `#e11d48`, `#2B63B0`, in both themes: `contrast(primary-foreground, primary) ≥ 4.5`, `contrast(primary, background) ≥ 3`, `skrum-primary-text` ≥ 4.5 on soft, card and background; warnings for too light, near-neutral, near-destructive; invalid hex throws; radius clamped; reference values of `sections/05-white-label.md` (`#2B63B0` unadjusted, `#FFD600` lowered with a warning, `#0a0a0a` near-neutral warning); `css()` output contains only `oklch(` numbers and the radius; `toHex()` values are valid hex.

### Task 3: Brand in the page

- [ ] `<style id="skrum-brand">` after `@vite` in `resources/views/app.blade.php`, rendered only when a brand colour or radius is stored; first-paint background unchanged.
- [ ] Display name: `config('app.name')` consumers that show the product name to users (`HandleInertiaRequests` shared `name`, the `<title>`, auth layout) read `InstanceSettings::displayName()`.
- [ ] Shared props: `brand` (`name`, `logoLightUrl`, `logoDarkUrl`, `faviconUrl`, `poweredBy`) and `auth.user.is_instance_admin` already serialised; `resources/js/hooks/use-sidebar-model.ts` sets `links.admin` for an instance admin; `SkrumLogo` callers in the new layouts show the instance logo through `<img>` when one is set (light and dark), else the Skrüm logo.
- [ ] Brand assets route: `GET /brand/{asset}` (`logo-light`, `logo-dark`, `favicon`) serving the stored file per Security rule 3, cacheable with a version query; favicon `<link>` uses it when set.
- [ ] Tests: no setting → no style tag, name unchanged; with settings → CSS present after the stylesheet link, escaped name in title; asset route headers; SVG CSP.

### Task 4: Admin area — routes, policy, admins

- [ ] Gate/policy `manageInstance`; route group `admin` (`auth`, `verified`): `admin/branding` (edit, update), `admin/branding/assets/{asset}` (store, destroy), `admin/admins` (index), `admin/admins/{user}` (store = grant, destroy = revoke), `admin` redirect to branding.
- [ ] Admins: list of instance admins and a search of users to grant; revoke with the last-admin rule (Security rule 2).
- [ ] Tests: Review Focus 1 for every route; grant, revoke, last admin, self-revoke when another admin exists.

### Task 5: Avatar style and GIF settings

- [ ] `AvatarsController` reads the instance style (fallback env), and the member's own style when `avatar_member_choice` is on (`users.avatar_style` nullable string, migration); styles limited to files present in `vendor/dicebear/styles/src`; "initials" is a valid choice that makes `avatarUrl` null so the front falls back to initials. The avatar URL carries a version so a style change is not masked by the immutable cache.
- [ ] Profile: `PATCH settings/profile` accepts `avatar_style` only when member choice is on.
- [ ] `GifCatalog` reads provider, key, rating and enabled flag from `InstanceSettings` (fallback config); default rating `g`.
- [ ] About: `GET /about` (auth) with product name, version, and the attribution lines for CC BY avatar styles (licence table from `AvatarStylePicker/README.md`), listing the active instance style and any member-chosen styles in use.
- [ ] Tests: style resolution order; member choice off ignores the user's style; unknown style falls back; GIF disabled hides the provider from page props (`gifProvider` null); key never in props; rating default.

Security review (one reviewer, read-only) after Task 5 on the whole back-end diff, against the Security rules. One fix agent if needed.

## Front tasks (after the back end)

### Task 6: Admin › Branding page

- [ ] `resources/js/pages/admin/branding.tsx` on `AppLayout` (`active="admin"`) + `SettingsLayout` (sub-navigation: Branding, Admins), per `ScreenSettings` frame b, Branding block only: logo uploads (light, dark) and favicon with preview and remove; display name; primary colour with the applied value, contrast badges ("AA 5.8:1") for both themes and warnings; radius segmented (Square 0, Soft 6, Standard 10, Round 16) plus exact value; `AvatarStylePicker` with "members can choose"; GIF provider (none, Giphy, Tenor), key field showing only "a key is set" with replace/clear, rating; "Powered by Skrüm" switch; live preview pane with a Light/Dark toggle (primary button, badge, selected card, focus ring) using the derived palette returned by the server for the typed colour (debounced `GET admin/branding/preview?color=&radius=` returning the palette and warnings, admin-only); "Reset to Skrüm"; unsaved-changes bar with Cancel / Save.
- [ ] Containers in `resources/js/components/admin/`; presentational pieces reuse `ui/` and `skrum/`.
- [ ] Vitest for the form logic; Pest feature tests for the props; a browser walkthrough (sign in as admin, change colour, see the contrast badge and warning, save, reload: brand applied; non-admin gets 403); the page added to the visual test in both themes, both widths, EN and FR.

### Task 7: Admins page, About page, profile avatar style

- [ ] `pages/admin/admins.tsx` (list, grant through Combobox, revoke with ConfirmDialog and the server error for the last admin).
- [ ] `pages/about.tsx` (new `AppLayout`), linked from the user menu of the new `UserCard`.
- [ ] Profile: when member choice is on, the existing `settings/profile` page gets the avatar style picker as a new card (the page keeps its old layout until 18e; only this card is added, with its browser test).
- [ ] Tests as in Task 6.

## Final verification and report

All suites (build, types, lint, Vitest, feature parallel, Arch, Rector, Pint, `bin/test-browser`), the rule greps, then one whole-branch review with a security lens, one fix wave, one scoped re-review.

Phase report: what is done; gaps with `ScreenSettings` and why; security checks performed; decisions taken for the owner; what 18f needs (`BrandPalette::toHex()`, brand shared props).

Known gap recorded now: `.ico` and 180px PNG favicons are not generated (no rasteriser allowed without a new package); the SVG favicon and the uploaded favicon cover current browsers.
