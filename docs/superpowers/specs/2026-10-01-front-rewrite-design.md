# Skrum — Front-end rewrite on the design system — Design

Date: 2026-10-01
Status: Design approved in conversation, awaiting spec review
Source of truth for visuals and component contracts: `docs/design-system/` (README, `sections/`, `tokens.json`, `app.css`, `php/BrandPalette.php`, `logos/`, `components/*/README.md` and `preview.html`).
Research base (inventories produced for this spec): `docs/superpowers/research/front-rewrite/`
- `inventory-pages.md`: every Inertia page with routes, props, actions, realtime events and permissions.
- `inventory-components.md`: every file under `resources/js` outside pages and generated code.
- `design-system-digest.md`: every component README and screen mockup, with contradictions.
- `route-callers.tsv`: the 292 application routes and the front files that call each.

The inventories were produced by static reading. Line references in them were not all re-verified; each plan re-reads the code it touches.

Plans: 18a–18g, one per phase (§12).

## 1. Problem statement

The front end still carries the Laravel starter kit: stock shadcn neutral tokens, the Laravel logo in the sidebar and on every auth page, the starter welcome page, one font, and ad hoc colours (120 default-palette classes, 89 arbitrary values, 74 hex literals). The product now has a design system with a brand, tokens verified for contrast in both themes, 94 component specifications and 34 screen mockups. None of it is in the application.

## 2. Goals

1. Every Inertia page is rewritten from its mockup on a new component library; no old view component remains.
2. No feature of the current front end is lost. Every action, shortcut and realtime behaviour listed in `inventory-pages.md` exists in the new front end.
3. The back end is kept: routes, controllers, policies, models, events, jobs and the Inertia prop contract. Back-end changes are limited to the list in §9.
4. The non-negotiable rules of §5 hold everywhere and are checked mechanically where possible.
5. An instance admin can rebrand the application without being able to break accessibility.

## 3. Non-goals

- Any mockup element whose back end does not exist and which is not listed in §9. These are not rendered. They are listed in §10 as backlog.
- Changing realtime protocols, reducers or the JSON contracts of live pages, except for the two new retro phases.
- Recoding the Excalidraw toolbar. The whiteboard is themed, not rebuilt.
- Dark-mode screen mockups. None exist; dark rendering is judged on tokens and component previews.
- Pricing, licence and image names on the landing page. The mockup marks them as placeholders; the landing ships without a pricing section until they are confirmed.

## 4. Decisions taken in conversation

| Topic | Decision |
|---|---|
| Inertia version | The repository is on Inertia v3. The rewrite stays on v3. |
| Existing Pest browser suite | It is a contract. The new front end keeps `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names. A test changes only when a mockup imposes another label or flow, in the commit of that screen. |
| Mockup elements without a back end | Out of scope unless listed in §9; recorded in §10. |
| Languages | `en`, `fr`, `es`, `de` stay complete. New keys are added to all four files. Visual captures run in FR and EN. |
| Migration strategy | In place, screen by screen. `app.css` and `components/ui` are replaced in phases 1 and 2; old pages run on them until rewritten in phase 5. There are never two versions of a component. |
| Containers | Per domain, in `resources/js/components/<domain>/`. No new base folder. |
| Instance admin | The first registered user is the instance admin (already the case in the code) and can name others (new). |
| Magic link and e-mail 2FA code | Built in this project (phase 6). |
| ⌘K | Navigation, commands and content search (new route). |
| Column colours | `ColumnColor` is extended to the eight design-system colours. |
| GIF providers | Tenor stays supported by the existing proxy; attribution follows the active provider. |
| Health check phase | Stays as an optional first phase. The mockups omit it; removing it would lose a feature. |

### 4.1 Dependencies

Approved additions:

| Package | Needed by |
|---|---|
| `@fontsource-variable/figtree`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/jetbrains-mono` | fonts |
| `recharts` | Chart, MoodTrendChart |
| `cmdk` | Command, Combobox |
| `vaul` | Drawer |
| `react-day-picker` | Calendar, DatePicker |
| `@radix-ui/react-popover`, `-tabs`, `-switch`, `-slider`, `-radio-group`, `-accordion`, `-progress` | shadcn primitives |
| `qrcode.react` | ShareDialog |
| `@testing-library/react`, `jsdom` (dev) | component tests |

`tw-animate-css` is already installed. Vitest ships with vite-plus.

Explicitly not added: `react-hook-form` (Inertia forms cover it), `@tanstack/react-table` (sorting, filtering and pagination are server-side), `react-hotkeys-hook` (a small in-house hook), `date-fns` (`Intl.DateTimeFormat`), `@radix-ui/react-scroll-area` (native overflow), `@dicebear/*` npm packages (avatars stay server-rendered), `mjml`.

If `react-day-picker` turns out to require `date-fns` as a peer, the plan stops and asks.

Kept: `live-cursors`, `live-reactions`, `frimousse`, `@dnd-kit/*`, `@excalidraw/excalidraw` pinned at 0.18.1, `input-otp`, `sonner`. The browser suite targets `.lc-overlay` and `button[frimousse-emoji]`.

Removed in phase 7 if unused: `@radix-ui/react-navigation-menu`, the Bunny font plugin usage.

## 5. Rules

These come from the brief and the design system. They are acceptance criteria for every commit.

1. **Tokens only.** No hex, rgb, `white`, `black` or default Tailwind palette class. Text on a solid colour uses its `*-foreground`. A text token is used only on the backgrounds named in its `tokens.json` note.
2. **rem everywhere.** px only for strokes ≤ 2px and the pill radius.
3. **Tailwind first.** A value in the scale uses its class. A value outside the scale is added to `@theme` in `app.css`. No arbitrary `[…]` value for a size. Arbitrary values are allowed for grid templates and `color-mix` only.
4. **No overflow.** Every component fits a container from 20rem to 60rem. Cards and rows adapt to their container (`@container/card`, `@container/action`). Card grids use `auto-fit`/`auto-fill` with `minmax`. Labels of selects, menu items, buttons and tabs never wrap (`truncate`).
5. **Visible focus**: `outline-2 outline-ring outline-offset-2`, never removed.
6. **Contrast**: AAA body text, AA secondary text, 3:1 controls. Destructive always has an icon and a label.
7. **Alignment**: a leading element aligns on the first line of the title.
8. **Motion**: `sections/02-motion.md`; `prefers-reduced-motion` respected everywhere.
9. **Icons**: lucide-react only, per `sections/03-iconographie.md`. Emoji only as a feature.
10. **i18n**: no fixed width on a label. The literal call shape `t('…')` is kept, because `TranslationKeysTest` scans for it.
11. **Presentational components**: typed props, no network, no Echo, no Inertia router or page-prop access. Those live in hooks and containers. Two exceptions: `useTrans()` for labels and Inertia's `<Link>` for navigation.
12. The values in `docs/design-system/app.css` are not modified. Additions to `@theme` are allowed for sizes missing from the scale.

## 6. Architecture

### 6.1 Folders

| Folder | Content | Rule |
|---|---|---|
| `resources/js/components/ui/` | Themed shadcn primitives | Replaced in place in phase 2 |
| `resources/js/components/skrum/` | Business components of the design system | Presentational only |
| `resources/js/components/<domain>/` | Containers per screen: `retro`, `poker`, `games`, `whiteboard`, `action-items`, `teams`, `workspaces`, `settings`, `auth`, `integrations`, `admin` | Wire hooks and `lib/*` to `skrum/` components. Old files in these folders are deleted in the commit that rewrites their screen. |
| `resources/js/layouts/` | `AppLayout`, `SessionLayout`, `SettingsLayout`, `AuthLayout`, `OnboardingLayout` | Assigned centrally in `app.tsx`, as today |
| `resources/js/lib/*`, channel hooks, `use-countdown`, `use-trans`, `use-appearance`, `use-local-preference`, `use-clipboard` | Kept as they are | Changed only where §9 requires |
| `resources/js/pages/**` | Same paths, same props | Thin: layout plus container |

### 6.2 Data flow of a live screen

Page (Inertia props) → domain container (channel hook, existing reducer, `retroRequest` with `X-Socket-ID`) → `skrum/` components (render only).

Realtime payloads are viewer-less and events go to others only, so the client applies HTTP responses and merges them. That logic lives in the existing reducers and stays untouched.

### 6.3 Layouts

- **AppLayout**: single sidebar and a topbar with breadcrumb, ⌘K field and bell.
- **SessionLayout**: sidebar collapsed to icons, session topbar with phases, timer, presence and share.
- **SettingsLayout**: sub-navigation inside the page. There is never a second sidebar, including for instance administration.
- **AuthLayout**, **OnboardingLayout**.

Sidebar, single model (`components/Sidebar/README.md`): brand, then the team switcher which contains the workspace; group *Team* (Dashboard, Sessions, Actions, Mood & ROTI, Games, Members); group *Workspace* (Templates, All teams); footer (Team settings, Administration, user). Administration is shown to instance admins only. On mobile, a tab bar with five entries: Home, Sessions, Actions, Mood, More.

Sessions, Mood & ROTI and Members have no page today. They link to the matching section of `teams/show` (tab or anchor). No new route.

### 6.4 Single models

- **Retro phases**: Health check (optional) → Icebreaker (optional) → Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed (session-end screen).
- **Poker**: one room, the oval table, with the story queue on the right and the deck at the bottom. Watch only and rounds are part of it.
- **ReactionBar**: one bar, floating bottom centre or stacked above a panel with a `space-3` gap. It never overlaps another element, including the poker deck and the FacilitatorBar. Reaction chips on a card are another component.
- **Whiteboard**: Excalidraw with its native toolbar, themed per `ExcalidrawTheme/README.md` (CSS variables and the eight sticky colours). `WhiteboardToolbar` in `skrum/` is the theming wrapper and the fallback colour bar that README describes, not a custom tool set. The existing DOM adjustments that target Excalidraw 0.18.1 internals must keep working.
- **Avatars**: DiceBear, server-rendered at `avatars/{seed}.svg`. The seed stays the existing HMAC of the user or participant id, never the e-mail. Background is the presence colour. Fallback is initials. No call to api.dicebear.com.
- **GIF**: through the existing Laravel proxy.

### 6.5 Rulings on design-system contradictions

Numbers refer to `design-system-digest.md` §5.

| # | Ruling |
|---|---|
| 1, 2, 3, 4, 6 | Identifiers, channel names and event names follow the back end (`discussing`, `survey`, existing `GameKind` values, `presence-whiteboard.{id}`, `presence-retro.{id}`). |
| 5, 29 | Native Excalidraw toolbar and shortcuts. |
| 7 | Presence colour stays as the back end assigns it today. User-chosen colour is backlog. |
| 8, 9 | Column and deck limits follow server validation. |
| 10 | Poker statistics are computed by the server; the front end displays what it receives. |
| 11 | Vote removal follows the current behaviour; VoteDots follows its README for rendering. |
| 13 | Five tabs. |
| 14 | No admin sidebar; sub-navigation in the page. |
| 19 | Timer increments follow what the timer endpoint and current UI offer (1, 3, 5, 10 minutes). |
| 21 | Digits go to ROTI, health check or survey when their panel is active, otherwise to reactions. Letter shortcuts are scoped per session type; only one session type is on screen at a time. |
| 26 | In phase Actions the main facilitator action is "Next phase" (to ROTI). The session ends from ROTI. |
| 27 | ReactionBar, settings icon, back button and icon share are present in every retro phase. |
| 28 | FacilitatorBar takes a list of typed actions per phase, so every existing facilitator action has a slot. |
| 35 | The sidebar entry Games uses `PartyPopper`, as `Sidebar/README.md` says. The icebreaker module elsewhere uses `Sparkles`, as `sections/03-iconographie.md` says. |

Components without a README (`SessionCard`, `StatCard`, `ColumnColorPicker`, `DeckEditor`, `Alert`, `Combobox`, `Kbd`, game UIs, survey builder, skeleton variants) are derived from the screen previews and the README that mentions them.

## 7. Page → mockup → components

Order is the order of phase 5.

| # | Pages | Mockup | Main `skrum/` components | Layout |
|---|---|---|---|---|
| 1 | "New retro / poker / whiteboard" dialogs of `teams/show` | ScreenSessionCreate | SessionTypePicker, RetroTemplatePicker, DeckPicker | App |
| 2 | `retros/show`, `retros/join`, `retros/session-ended` | ScreenRetroWriting, Grouping, Vote, Discussion, Actions, ROTI; MobileRetro | RetroColumn, RetroCard, CardGroup, VoteDots, PhaseStepper, FacilitatorBar, Timer, SessionSettingsPopover, ReactionBar, PresenceStack, LiveCursor, ConnectionState, ActionItem, ROTIWidget, HealthCheck, GifPicker, ShareDialog, GuestJoin | Session |
| 3 | `poker/show`, `poker/join`, `poker/estimates` | ScreenPokerBefore, After, Queue; MobilePoker | PokerTable, PokerCard, DeckPicker, Timer, ReactionBar | Session, App |
| 4 | `teams/show` | ScreenDashboard, ScreenTeam; MobileDashboard | EmptyState, MoodTrendChart, HealthCheck (statements), ActionItem | App |
| 5 | `action-items/index` | ScreenActions | ActionItem | App |
| 6 | `games/index`, `games/show`, `games/join` | ScreenIcebreaker, Draw, Emoji, Gif; MobileRituals | IcebreakerGameCard, GamesLeaderboard, GifPicker | App, Session |
| 7 | `whiteboards/show`, `whiteboards/join` | ScreenWhiteboard | WhiteboardToolbar, ReactionBar, PresenceStack | Session |
| 8 | Surveys inside the retro | ScreenSurvey | SurveyQuestion | Session |
| 9 | `workspaces/show`, `create`, `members`, `templates` | ScreenWorkspace | TemplateEditor, RetroTemplatePicker | App |
| 10 | `settings/*` (5), `teams/integrations`, Admin › Branding | ScreenSettings, ScreenUserSettings, ScreenSecurity | AvatarStylePicker | Settings |
| 11 | `auth/*` (7), `invitations/show`, error pages | ScreenAuth, ScreenOnboarding, ScreenErrors; MobileAccess | GuestJoin, EmptyState | Auth, Onboarding |
| 12 | `welcome` | ScreenLanding | none | none |

Designed from neighbouring mockups, because no mockup exists:

- `workspaces/members`, `workspaces/create`: from ScreenWorkspace and ScreenTeam.
- `teams/integrations`: from ScreenSettings, as a section of the sub-navigation.
- Health check phase of the retro: HealthCheck inside the ScreenRetro frame.
- Results and insights of a completed retro: inside the session-end screen of ScreenRetroROTI.
- `auth/confirm-password`, `verify-email`, `reset-password`, `two-factor-challenge`: from ScreenAuth.
- Whiteboard templates: stay managed from the team page.

## 8. Feature parity

The features below exist today and must exist in the new front end. The full action list per page is in `inventory-pages.md`.

- Workspaces: switcher, teams, "Leave workspace", templates, members, creation.
- Team page: retros, poker (active games, Estimation history, Saved decks), whiteboards and their templates, health check statements (built-in and custom, reorder, archive, restore), members.
- Retro: phases, coloured columns and add column, "Add survey", timer, settings, groups, votes, comments, card reactions, GIFs, highlight, lock, presentation mode, live cursors, flying reactions, action items with comments, subtasks, exports and external links, insights, results, shares, results e-mail, guest join, session ended.
- Poker: draggable task queue, Watch only, Hide tasks, rounds, Re-vote, Estimate, Save estimate, Next task, timer, shares, guest join.
- Whiteboard: Excalidraw scene sync, files, timer, locks, viewport follow, guest join.
- Games: rooms, leaderboard, the existing game engines, guest join.
- Reaction bar.
- Action items index with filters, realtime updates and all item actions.
- User settings: Profile, Security (password, 2FA, passkeys), Appearance, Notifications, API tokens.
- Team integrations.
- Auth: login, register, forgot and reset password, e-mail verification, 2FA challenge, password confirmation, SSO, invitation acceptance.
- DiceBear avatars, locale switch, dark mode without flash.

Per screen, the phase report carries a table "action in the old front end → control in the new one", built from the inventory.

## 9. Back-end changes

Each item is approved by this spec once the spec is approved. Nothing else on the back end changes.

| # | Change | Phase |
|---|---|---|
| B1 | `RetroPhase` gains `Actions` and `Roti` between `Discussing` and `Completed`. Neighbour rule, `Retro::phases()`, guards, visibility rules, `phase` payloads, TS types and reducer updated. Open retros in `discussing` move forward through the new phases; completed retros are unchanged. | 5.2 |
| B2 | ROTI is collected in phase `roti`. It stays readable in `completed`. Voting on ROTI in `completed` stays allowed for retros completed before the change, so nothing is lost. | 5.2 |
| B3 | Session-end screen: `completed` already serves results, exports and the recap e-mail. Props are added only if the mockup needs data that the server already holds (duration, participation, counts). | 5.2 |
| B4 | Instance settings: table `instance_settings`, cache, and an Admin area with routes and a policy. Sections: Branding, Admins. `users.is_instance_admin` already exists and the first registered user (form or SSO) already receives it; nothing changes there. New: admins can grant and revoke the flag from Admin › Admins; the last admin cannot be revoked. | 4 |
| B5 | `App\Support\Branding\BrandPalette` from `docs/design-system/php/BrandPalette.php`, adapted to the project's PHP guidelines, plus `toHex()`. `<style id="skrum-brand">` is injected after `@vite` in `app.blade.php`. | 4 |
| B6 | Branding settings: colour, light and dark logos, favicon, radius (0–16px), display name, "Powered by Skrüm" toggle, DiceBear avatar style with "members can choose" (`users.avatar_style`, nullable), GIF provider key and enable switch. Environment variables stay as defaults when no setting is stored. Default GIF rating becomes `g`. | 4 |
| B7 | CC BY attribution for the active avatar style on an "About" screen reachable from the user menu. | 4 |
| B8 | Local-only route `/dev/design-system`. | 1 |
| B9 | `auth.user.avatarUrl` in shared props. Today the page reads `auth.user.avatar`, which is never sent, so the signed-in user always sees initials. | 1 |
| B10 | `ColumnColor` becomes `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss`. Data migration for `columns` and `workspace_template_columns`: green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris. Built-in template catalogue, validation rules, MCP and export payloads that expose the colour are updated. | 5.2 |
| B11 | Search route for ⌘K: `GET /search?q=` returns retros, poker games, whiteboards, game rooms and action items whose title or content matches, limited to teams the user can view, throttled, minimum two characters. | 6 |
| B12 | Magic-link login: request by e-mail, signed single-use link valid 15 minutes, token stored hashed, resend cooldown of 60 seconds, throttled per e-mail and per IP, same response whether or not the address exists. A user with a second factor is still challenged. Not offered when registration or password login is replaced by forced SSO. | 6 |
| B13 | E-mail code as a second factor: a user enables it in Security; at the challenge a 6-digit code valid 10 minutes is sent, stored hashed, with a 60-second resend cooldown and a limit of five attempts. TOTP, recovery codes and passkeys are unchanged. | 6 |
| B14 | E-mails as Mailables per `components/Emails/README.md`, light and dark, using `BrandPalette::toHex()`: magic link, invitation, action reminder, retro recap, 2FA code. The three existing notifications keep their triggers and recipients. | 6 |
| B15 | Custom Inertia error pages for 403, 404, 500, 503. | 5.11 |
| B16 | Shared props for the team-centred sidebar: `currentTeam` (`id`, `name`, `membersCount`, or null) and `teams` (`id`, `name` of the teams of the current workspace visible to the user). The current team is the `team` route parameter when present; otherwise the last team visited, remembered in the session; otherwise the first visible team by name. Page props named `teams` on `settings/api-tokens` and `action-items/index` have another shape and are renamed when plan 18e rewrites those screens. | 1 |

B12 and B13 are authentication changes. Their plan includes a security review step before merge.

Known limit of B12 with B13: a magic link followed by an e-mail code proves control of the same mailbox twice. This is accepted and stated on the Security screen.

## 10. Backlog (out of scope, not rendered)

Device sessions with geolocation; linked accounts; password breach check and "last changed"; user-chosen presence colour; profile photo upload; account deletion; reduced-motion account setting; resumable four-step onboarding; team colour, slug, description, owner and observer roles; team invite link with expiry; default facilitators and rotation; access request from the 403 page; Sessions index with scheduling and drafts; team activity feed; current sprint and sprint entity; per-phase timers; duplicate detection and auto-grouping; undo last group; collaborative discussion notes; "finished voting" flag; ROTI nudge; action status `doing`; bulk action update and bulk Jira sync; manual action creation outside a retro; actions sourced from whiteboards and surveys; Jira JQL import and story description in poker; similar stories; whiteboard comments, follow a user, convert stickies to actions, thumbnails; poker templates at workspace level; survey builder extras (anonymity modes, close date, threshold, compare to previous sprint, send to whiteboard, CSV); pinning a GIF to a retro; join by short code; admin sections General, SSO, SMTP, Integrations, MCP keys, Licence, Users, Audit log, backups, maintenance message, version check; landing pricing.

When a mockup shows one of these, the screen omits it and the phase report records the gap.

## 11. Testing and verification

- **Pest browser suite**: green at the end of every phase. Selectors and English accessible names are preserved (§4).
- **Pest feature tests**: every back-end change of §9, including brand contrast in both themes for `#FFD600`, `#22c55e`, `#777777`, `#0a0a0a`, `#e11d48`, `#2B63B0` (`contrast(primary-foreground, primary) ≥ 4.5`, `contrast(primary, background) ≥ 3`).
- **Vitest**: logic of `skrum/` components: card masking, remaining votes display, timer states, rendering of poker average, median and consensus from server values, validation in TemplateEditor and DeckPicker. Where the server computes the value, tests cover display and states, not the calculation.
- **Visual test (Playwright)**: captures `/dev/design-system` and every screen in light and dark, at 1440 and 390, in FR and EN, stored in `tests/visual/__screenshots__/`. It fails on horizontal overflow (an element leaving its parent without an intended `overflow`). Captures are compared by eye with the `preview.html` files.
- **Per phase**: `npm run build`, `npx tsc --noEmit`, `npm run check`, `php artisan test`, Vitest.
- The whiteboard has no browser test today. Its parity is checked by hand against the inventory and by captures; a smoke test is added in phase 5.7.

## 12. Phases

Each phase is one plan, one branch from up-to-date `main`, merged locally after its report is accepted. Phase 5 is one commit per screen on its branch.

| Plan | Phase | Content | Deleted |
|---|---|---|---|
| 18a | 1 Foundations | `app.css` replaced by the design-system file; fonts; `components.json`; dark mode kept on the existing class, cookie and inline script; logos in `public/brand/`, favicon, `<SkrumLogo>`; `/dev/design-system`; the five layouts; visual test harness; Vitest setup; B8, B9 | The eight dead starter files, Instrument Sans |
| 18b | 2 Themed shadcn | All primitives of the brief with every state on `/dev/design-system` | Replaced primitives |
| 18c | 3 Business components | `components/skrum/*` per README, on `/dev/design-system`, with Vitest | none |
| 18d | 4 White-label and admin | B4–B7, Admin › Branding per ScreenSettings with live preview, contrast ratios and warnings | none |
| 18e | 5 Screens | §7 in order, with B1–B3, B10, B15 | Old code of each screen in its commit |
| 18f | 6 Cross-cutting | B11–B14, bell wired to the existing notification routes, global shortcuts and KeyboardShortcuts (`?`) | none |
| 18g | 7 Clean-up | Remaining starter kit and old front end, orphan dependencies, `knip` clean, the three greps of the brief | Everything left |

End-of-phase report: what is done; gaps with the mockups and why; old features verified; code deleted; missing tokens or components; next step.

## 13. Acceptance criteria

1. Every page of §7 renders from the new library under its new layout, at 1440 and 390, in light and dark, in all four languages, without horizontal overflow.
2. Every action in `inventory-pages.md` has a control in the new front end, shown in the parity table of its phase report.
3. The Pest browser suite passes; any changed test is justified by a mockup in the commit that changes it.
4. `php artisan test`, Vitest, `npm run build`, `npx tsc --noEmit` and `npm run check` pass at the end of every phase.
5. Grep finds no `bg-(red|blue|gray|zinc|neutral|slate)-`, no `text-white`, no `-\[[0-9.]+(px|rem)\]` under `resources/js` and `resources/views`.
6. `npx knip` reports nothing on the front end.
7. No file of the starter kit front end remains: Laravel logo and name, old layouts, unused components, CSS and icons.
8. No `sk-*` class and no part of `_preview-bundle.css` is in the application.
9. A retro runs Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed with a member and a guest in two browsers, without a reload.
10. Brand contrast tests pass for the six reference colours in both themes; the Branding screen shows the entered value, the applied value, the ratios and the warnings.
11. Avatars are served by the application with no request to api.dicebear.com; GIFs go through the proxy and show the provider's attribution.
12. With `prefers-reduced-motion`, there are no flying reactions, no confetti, and the card flip is a fade.
13. Every item of §9 is covered by feature tests; B12 and B13 pass a security review.

## 14. Risks

- Phase 2 changes how old pages look until they are rewritten. The browser suite is the guard.
- The browser suite binds to English text. Mockup labels that differ from current labels cause test edits; each is listed in the phase report.
- Excalidraw is themed through internals of 0.18.1. The version stays pinned.
- B1 and B10 touch persisted data and public payloads (MCP, webhooks, exports). Their plan lists every consumer before changing the enum.
- B12 and B13 add authentication surface to a front-end project. They are isolated in phase 6 and reviewed separately.
- The inventories are static readings. A feature missed there would be missed in the rewrite; each screen's plan re-reads the old code before deleting it.
