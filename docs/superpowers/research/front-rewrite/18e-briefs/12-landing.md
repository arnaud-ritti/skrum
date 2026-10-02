# Brief 12 — LANDING (`welcome`)

Not verified: nothing run (read-only). Not read in full: `ui/button`, `ui/sheet`, `ui/tabs` props; `phase-stepper`/`retro-card`/`retro-column` prop shapes (only located). Mockup read as extracted text (README + preview.html), not rendered.

## 1. Scope
| Item | Value |
|---|---|
| Page | `resources/js/pages/welcome.tsx` (397 lines, stock Laravel starter, 66 hex literals, Laravel logo SVG) |
| Route | GET `/` name `home`, closure at `routes/web.php:170` (`Inertia::render('welcome', ['canRegister' => SignupGate::canShowRegistration()])`). No auth middleware. |
| Layout | none (`app.tsx` switch `name === 'welcome'` returns `null`). Keep: the landing owns its nav and footer. No layout change, so no `app.tsx` edit. |
| Mockups | `docs/design-system/components/ScreenLanding` (desktop 1440, FR only), `MobileAccess` phone 1 "Landing — hero + modules" (390). Phones 2-3 (login, guest join) belong to other groups. |
| Spec | §10 backlog: "landing pricing" and "join by short code" NOT rendered; §3/§4 line 34: ships without pricing until confirmed; §7 row 12: no business component, no back-end change. |
| Shared props used | `auth.user`, `brand` (`name, logoLightUrl, logoDarkUrl, faviconUrl, poweredBy`), `name`, `locale`, `locales`, `canRegister` (page prop). |

## 2. Commits
1. `feat(landing): welcome page from the ScreenLanding mockup` — rewrites `pages/welcome.tsx`; adds `components/landing/*` containers (section below), `pages/dev/sections/landing.tsx` (design-system preview, same pattern as `dev/sections/about.tsx`), lang keys x4, Vitest, Pest feature + browser tests. Deletes: the 66-hex body of `welcome.tsx` (file rewritten, not removed), the unused i18n keys `Laravel has an incredibly rich ecosystem.`, `We suggest starting with the following.`, `Read the`, `Watch video tutorials at`, `Deploy now`, `Let's get started` (grep first; `Documentation` may be reused). No other old component exists for this page (inventory: no component of its own).
(Single commit: one screen, no business component.)

## 3. Parity table (old front, inventory-pages §"pages/welcome.tsx")
| Action | Old control (welcome.tsx) | Route / event | New control | Browser hook | Note |
|---|---|---|---|---|---|
| Signed in: go to dashboard | `<Link href={dashboard()}>` "Dashboard" l.21-26 | GET `/dashboard` (redirect to workspace) | nav primary `Button asChild` + `Link`, label t('Dashboard'); also hero primary CTA when `auth.user` | none today; keep accessible name "Dashboard" | replaces "Se connecter"/"Essayer gratuitement" when signed in |
| Guest: log in | `<Link href={login()}>` "Log in" l.29-34 | GET `/login` | nav ghost button t('Log in'); mockup FR "Se connecter" is the same key (lang/fr already maps it) | name "Log in" | also repeated in mobile Sheet menu |
| Guest: register (only if `canRegister`) | `<Link href={register()}>` "Register" l.35-42 | GET `/register` | nav primary CTA + hero primary CTA + final-CTA primary; label t('Register') | name "Register" | rendered only when `canRegister`; see §9 for what replaces it otherwise |
| External links "Documentation", "Laracasts", "Deploy now" | l.67, 98, 124 | laravel.com, laracasts.com, cloud.laravel.com | REMOVED (Laravel promotion, not product) | none | no parity needed: they are starter-kit content |
| Dark mode / theme | `dark:` hex variants | n/a | semantic tokens only (`bg-background`, `text-foreground`, `--skrum-primary-text`) | n/a | rule §5: no hex, no default palette |
| Tab title | `<Head title={t('Welcome')}>` | n/a | `Head` with title and meta description, see §9 | n/a | |
| Language switch | none (inventory: "no language switcher") | PUT `locale.update` | optional: reuse `components/language-switcher.tsx` in footer | none | new, designed from neighbours; decision D5 |
Total: 7 rows (page has 3 real actions).

## 4. Composition
Container folder `resources/js/components/landing/` (new domain folder; spec §6 allows `components/<domain>/`). Proposed files, each a pure presentational container fed by static i18n copy (no server data except the props below):
| File | Content | Primitives |
|---|---|---|
| `landing-nav.tsx` | brand logo (`BrandLogo` from `skrum/brand-logo.tsx` with `fallback=<SkrumLogo variant="horizontal"/>` plus instance name), Log in, primary CTA; mobile: burger -> `ui/sheet` | `Button`, `Sheet`, `BrandLogo`, `SkrumLogo` |
| `landing-hero.tsx` | badge, display title (2nd half `text-primary-text` / `--skrum-primary-text`), lead, 2 CTAs (full width stacked on mobile) | `Badge`, `Button` |
| `landing-product-preview.tsx` | mini retro board, static fixture | `PhaseStepper`, `Timer`, `PresenceStack`, `RetroColumn`, `RetroCard`, `VoteDots`, `ActionItem`, `LiveCursor` (all exist in `components/skrum/`). Props must be read from source: all are driven by static literals, no `useEcho`. Mobile: columns horizontal scroll, Actions panel below. Preview stepper in mockup shows 3 phases only (digest line 595): use the real 7-phase model or mark as illustrative. Decorative: wrap in `aria-hidden`/`inert` so no focus stops on demo cards. |
| `landing-modules.tsx` | Retros, Poker, Whiteboard, Icebreakers, Surveys cards | `Card`; mini visuals composed from `PokerCard`, `CardGroup`, `VoteDots`; whiteboard sticky + arrow, icebreaker letters, ROTI stars are COMPOSED from primitives (no `sk-sticky/sk-letter/sk-roti` landing component; `roti-widget.tsx` exists but is interactive) |
| `landing-self-host.tsx` | 4 arguments, code block with `Tabs` (Docker Compose / Helm), "Apparence de l'instance" card with `Slider` | `Card`, `Tabs`, `Slider`; copy-to-clipboard button is NEW behaviour (navigator.clipboard, try/catch) |
| `landing-footer.tsx` | columns, version, "Powered by Skrüm" per `brand.poweredBy` | links |
| `landing-cta.tsx` | final CTA on `--skrum-primary-soft` | `Button` |
Page `pages/welcome.tsx`: `<Head>`, composes the above; reads `usePage().props` (`auth.user`, `brand`) and `canRegister`; builds a `cta = {href,label}` helper (signed in -> `dashboard()`; guest + canRegister -> `register()`; guest + !canRegister -> `login()`).
Adapters: server -> props: `canRegister: boolean` -> `showRegister`; `brand.logoLightUrl/logoDarkUrl/name` -> `BrandLogo brand`; `brand.poweredBy` -> footer line; `auth.user` -> signed-in variant. Use Wayfinder `@/routes` (`login`, `register`, `dashboard`) as today; `useTrans` `t()` for all copy; no `lib/*` or hook reuse beyond `use-trans`.
Not available: "Join with a code" (MobileAccess, see §6), docs/changelog/status/legal pages, GitHub link (repo `https://github.com/arnaud-ritti/skrum` per `git remote`, but see D4).

## 5. Realtime
None. Page subscribes to no channel (inventory). The preview board is static; do not import `useEcho`/board hooks. Two-browser behaviour: n/a.

## 6. Mockup elements not rendered / without mockup
Not rendered (spec §10 + this brief):
- Whole **Tarifs** section and plan buttons (Commencer, Essayer 14 jours, Nous contacter), nav link "Tarifs", "Self-host : gratuit" banner (spec line 34, §10).
- "Rejoindre avec un code" button (MobileAccess; no join-by-code route: grep `routes/web.php` finds none; §10 "join by short code").
- Nav "Changelog", "Documentation", footer "Statut du service", "Confidentialité", "Mentions légales", "Configuration SSO", "Chart Helm", "Guide d'installation": no such pages exist. Render only links with real targets (decision D4).
- "Essayer gratuitement" / "Lancer une rétro gratuite" imply a free SaaS trial: this product has no SaaS plans, so reword to signup-mode-aware CTAs (§9).
No mockup: dark theme (tokens cover it), EN/ES/DE copy (mockup FR only), signed-in variant, locale switcher, instance-name/logo white-label state, `canRegister=false` state. Design from neighbours: `layouts/skrum/auth-layout.tsx` (brand block + `poweredBy`), `pages/about.tsx` (public-ish page pattern), `ui/button` variants.

## 7. Back-end changes
None listed in spec §9 for this group. Gaps (report only): (a) `<meta name="description">` and Open Graph tags do not exist: `resources/views/app.blade.php` sets only `<title>` via `<x-inertia::head>`; page-level `<Head><meta name="description" .../></Head>` suffices without back-end change. (b) `<html lang>` already `str_replace('_','-',app()->getLocale())` (app.blade.php:6): OK. (c) no `robots.txt`/sitemap check done beyond grep (none found); not needed.

## 8. Browser tests
- Existing: no Pest browser test visits `/` or asserts welcome copy (grep of `tests/Browser` for `visit('/')`, "Welcome", "Laravel": nothing). `tests/Feature/ExampleTest.php` asserts `route('home')` is 200 (keep). Several feature tests `assertRedirect(route('home'))` after logout/deletion (no front dependency).
- Must change: none imposed by the mockup.
- New (convention `[Pxx-nn]`; pick the next free prefix from tests/Browser): `[P12-01]` guest sees "Log in" link to `/login` and no console errors, in `invite` mode no "Register" link; `[P12-02]` with `SKRUM_SIGNUP_MODE=open` "Register" link present to `/register`; `[P12-03]` signed in sees "Dashboard" and no "Log in"; `[P12-04]` instance with brand name/logo set shows that name (not "Skrüm" hard-coded) and the title; `[P12-05]` mobile 390: burger opens Sheet with the CTAs, no horizontal page scroll. Feature (Pest): Inertia assert `canRegister` true/false per `SignupMode` (+ first user); `home` returns 200 with `auth.user` null/non-null. Vitest: `landing-nav` (CTA matrix: 3 states x canRegister), `landing-self-host` copy button. Visual: add `AdminPagesVisualTest`-style entry in `tests/Browser/Visual` (pattern from 18d) for `landing-page` light/dark x 1440/390 x en/fr; `dev/sections/landing.tsx` registered like `about`.

## 9. Risks and open questions
Signup mode effect (code verified): `SignupGate::canShowRegistration()` is true when no user exists yet (first visitor becomes instance admin) or mode `open` or `domain`; false in `invite` (the config default, `config/skrum.php:8`, `SignupMode::fromConfig()` falls back to `Invite`). Mode `domain` still shows Register (the domain check happens at submit). `canRegister` on `/` passes NO invitation argument, so the `invite`-mode "pending invitation in session" case is not reflected on `/` (it is on `/login`).
| CTA state | Primary CTA | Secondary |
|---|---|---|
| signed in | Dashboard | none |
| guest, canRegister | Register (`/register`) | Log in |
| guest, invite mode | Log in (`/login`) | none; no "Register", no "free trial" wording; hero copy must not promise sign-up |
| first run (no users) | Register (it is the instance admin creation; README line 41) | Log in |
Risks:
- Every marketing claim of the mockup describes a SaaS vendor, not this instance (see D1/D2). Copy shipped on a customer's self-hosted instance would be wrong or misleading.
- `app.tsx` title callback gives "Welcome - <name>" today; mockup wants a marketing title. `Head title` + `app.blade.php` default `<title>` is the instance display name; avoid duplicating the name (`title` already appends `- <name>`).
- Product-preview must not use `useEcho`; make it inert so `data-test`/`data-realtime`/`data-presence-id` hooks of the real board (browser contract) are not duplicated on a page where tests query them (use no `data-*` hooks in the preview).
- Preview stepper shows 3 phases while the app has the 7-phase model (digest line 595); and B1 (new `Actions`/`Roti` phases) lands in 5.2: align the fixture.
- Static English-only claims: copy has to be written four times (en, fr, es, de) in `lang/*.json`; mockup is FR only, so FR is source for review and EN keys must stay the key (project convention: key = English text).
- Hard-coded `'Skrüm'` text vs white-label: use `brand.name` everywhere (nav, hero badge, footer, CTA), never literal; `poweredBy` toggles the "Skrüm" credit.
- Pint/arch rules: none (front only). Lint rule against hex/default palette (spec §5) must pass: mini visuals must use tokens (`sk-c-*` equivalents).

### Claims in the mockup needing product-owner confirmation before publication
| # | Claim (copy in mockup) | Why unverified |
|---|---|---|
| 1 | Licence "AGPL-3.0" (self-host card, bandeau, footer "© 2026 Skrüm · Licence AGPL-3.0", hero badge "Open source") | No LICENSE file in the repo; `composer.json` says `"license": "MIT"` (inherited from `laravel/react-starter-kit`), README states none. README flags it as placeholder. |
| 2 | Docker image `ghcr.io/skrum/skrum:1.8` and Helm `oci://ghcr.io/skrum/charts/skrum` | README uses `ghcr.io/arnaud-ritti/skrum:1.0` (via `SKRUM_IMAGE`); `config/skrum.php` version default `1.0.0`; no Helm chart exists in the repo (not searched under deploy/ exhaustively). |
| 3 | Compose snippet keys: `ports 8080:8080`, `DB_CONNECTION: pgsql`, `OIDC_ISSUER`, `MAIL_HOST`, `depends_on: postgres, redis` | README documents Caddy on 80/443 and its own env set (`SKRUM_*`); compose shape must be copied from the real `compose.yaml`/README, not the mockup. |
| 4 | "Une image Docker, une base PostgreSQL" | DB engine support not checked here. |
| 5 | "SSO OIDC (Keycloak, Entra ID, Authentik, Google Workspace)" and "SAML, SCIM" | Code has `SsoProvider` keys `google, github, entra, oidc` only; no SAML/SCIM in the app (digest: "SAML/SCIM backend implied"). Do not publish SAML/SCIM. |
| 6 | "Votre branding: logo, couleur primaire, rayons, nom d'instance" | Matches B6 (colour, logos, favicon, radius 0-16px, name); confirm wording only. |
| 7 | "Votre SMTP: liens magiques et rappels d'actions" | Magic link login: check it exists (Fortify + passkeys + SSO seen; magic link not verified by me). MobileAccess login phone also promises it: belongs to group auth. |
| 8 | Hero: "chaque décision devient une action suivie, avec responsable et échéance"; "cartes face cachée jusqu'à la révélation, médiane et dispersion, import des stories depuis Jira"; "Whiteboard: curseurs en direct"; "Icebreakers: pendu d'équipe, deux vérités un mensonge"; "Sondages: ROTI, NPS, choix multiple, anonymes par défaut, tendance d'un sprint à l'autre" | Feature claims: verify each against shipped features (spec §10 lists survey extras, "compare to previous sprint", Jira import in poker, as NOT built). NPS and "tendance d'un sprint à l'autre" very likely unbuilt. |
| 9 | "Formats 4L, Start/Stop/Continue, Voilier" | Check retro template list. |
| 10 | "Créez une session en 30 secondes ... l'équipe rejoint sans compte" | Guest join exists (`*/join` pages); "30 secondes" is a marketing number. |
| 11 | "SaaS hébergé en Union européenne", "Hébergement UE, DPA", "Open source · SaaS ou auto-hébergé" | There is no hosted SaaS in this repo. |
| 12 | Pricing (0 €, 8 €/membre/mois, essai 14 jours, "Sur devis", plan limits 1 team / 10 participants / 3-month history), "Rôles et journal d'audit", "Support prioritaire" | Out of scope per spec; no billing/plan limits in back end. Not rendered. |
| 13 | Preview data: team "Atlas", Jira key "ATLAS-1302", names (Camille, Théo...) | Fixture; fine if clearly generic; confirm no real names. |
| 14 | Footer pages (Documentation, Changelog, Statut, Confidentialité, Mentions légales) and nav GitHub target | Do not exist as routes; GitHub remote is `arnaud-ritti/skrum` (the mockup says `skrum/...`). |

### Decisions needed (product owner)
- D1: **Should a self-hosted instance show a marketing landing at all?** Options: (a) keep `/` as marketing for the project (public page on every instance, "Skrüm" promoting itself, contradicts white-label); (b) minimal "instance entry" page: instance name/logo, tagline, Log in / Register per signup mode / Dashboard, no module marketing; (c) `/` redirects guests to `/login` and signed-in users to `/dashboard`. Recommendation to weigh: (b) as the default on every instance, the full marketing sections gated behind a setting or shipped only on the project's own site. Needs an answer before commit 1; without it the plan is full mockup minus pricing, white-label via `brand.name`.
- D2: Final licence name (and add a LICENSE file; fix `composer.json` MIT).
- D3: Canonical image path, tag policy, Helm chart existence, and the real Compose snippet to display.
- D4: Which footer/nav links to ship (GitHub URL, docs, changelog, legal pages) and their targets.
- D5: Locale switcher on the landing (none today; the 4 locales exist) and default copy language for guests.
- D6: Which module/feature claims are allowed (row 8-9 above), notably NPS, trends, Jira import, magic link, SAML/SCIM.
- D7: In `invite` mode, what a guest sees (Log in only, plus a line "Sign-up is by invitation"?) and whether to pass the pending invitation to `canShowRegistration` on `/`.

## 10. Size
- Containers to write: 6-7 under `components/landing/` + page rewrite; skrum/ui components reused: ~12, composed visuals: 4 (sticky/arrow, letters, ROTI stars, distribution bars).
- Old files deleted: 0 whole files (page rewritten); ~6 lang keys per language x4 files removed/renamed; new keys ~40-60 x4 languages.
- Tests: 0 existing touched; ~5 browser, 2 Feature, 2-3 Vitest, 1 visual (x8 screenshots) new.
- Parallelism: independent of other groups. Shared files touched: `lang/{en,fr,es,de}.json` (merge conflicts likely with every group: keep a single appended block), `resources/js/pages/dev/` registry (section list) and `tests/Browser/Visual` list. Does NOT touch `app.tsx` layout switch, types, shared hooks. Can run first or last; if D1 picks (c), the work shrinks to a controller redirect and tests.
