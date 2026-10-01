# Inertia page inventory — skrum (front-end rewrite baseline)

Generated 2026-10-01 from `main` @ 84d4c2d by static reading (no browser run). Assembled from one cross-cutting part and eight page slices; each slice ends with its own "Slice notes" and "Could not verify" list. Companion file: `route-callers.tsv` (every route with the front files that call it).

Contents: 0 cross-cutting (route table, layouts, shared props, i18n, realtime infra, JSON endpoints, uncalled routes, tests/tooling, dead code) · 1 welcome/auth/settings · 2 workspaces, action items, invitations · 3 teams and integrations · 4 retro board core · 5 retro secondary features · 6 poker · 7 games · 8 whiteboards



---

<!-- part: 00-cross-cutting -->

# Cross-cutting inventory (applies to every page)

## A. Page → route table (all 32 pages)

`auth`+`verified` = the `Route::middleware(['auth','verified'])` group (routes/web.php:196). `ws` = `can:view,workspace` + `RememberCurrentWorkspace` + scoped bindings (routes/web.php:214-217). All web routes also run `HandleAppearance`, `SetLocale`, `HandleInertiaRequests` (bootstrap/app.php:34-39).

| # | Page file | Method + URI | Route name | Rendered by (file:line) | Middleware of note | Layout |
|---|---|---|---|---|---|---|
| 1 | `welcome.tsx` | GET `/` | `home` | closure, routes/web.php:166 | none | none (`null`) |
| 2 | `auth/login.tsx` | GET `/login` | `login` | Fortify `loginView`, app/Providers/FortifyServiceProvider.php:54 | `guest` (Fortify) | AuthLayout |
| 3 | `auth/register.tsx` | GET `/register` | `register` | Fortify `registerView`, FortifyServiceProvider.php:80 (aborts 403 when `SignupGate::canShowRegistration` is false, :78) | `guest` | AuthLayout |
| 4 | `auth/forgot-password.tsx` | GET `/forgot-password` | `password.request` | Fortify `requestPasswordResetLinkView`, FortifyServiceProvider.php:67 | `guest` | AuthLayout |
| 5 | `auth/reset-password.tsx` | GET `/reset-password/{token}` | `password.reset` | Fortify `resetPasswordView`, FortifyServiceProvider.php:61 | `guest` | AuthLayout |
| 6 | `auth/verify-email.tsx` | GET `/email/verify` | `verification.notice` | Fortify `verifyEmailView`, FortifyServiceProvider.php:71 | `auth` | AuthLayout |
| 7 | `auth/two-factor-challenge.tsx` | GET `/two-factor-challenge` | `two-factor.login` | Fortify `twoFactorChallengeView`, FortifyServiceProvider.php:87 | `guest` | AuthLayout |
| 8 | `auth/confirm-password.tsx` | GET `/user/confirm-password` | `password.confirm` | Fortify `confirmPasswordView`, FortifyServiceProvider.php:89 | `auth` | AuthLayout |
| 9 | `invitations/show.tsx` | GET `/invitations/{token}` | `invitations.show` | InvitationLinksController@show :19 (invalid) / :36 | none (public) | AuthLayout |
| 10 | `workspaces/create.tsx` | GET `/workspaces/create` | `workspaces.create` | WorkspacesController@create :17 | auth+verified | AppLayout |
| 11 | `workspaces/show.tsx` | GET `/w/{workspace}` | `workspaces.show` | WorkspacesController@show :35 | auth+verified, ws | AppLayout |
| 12 | `workspaces/members.tsx` | GET `/w/{workspace}/members` | `workspaces.members.index` | WorkspaceMembersController@index :25 | auth+verified, ws | AppLayout |
| 13 | `workspaces/templates.tsx` | GET `/w/{workspace}/templates` | `workspaces.templates.index` | WorkspaceTemplatesController@index :24 | auth+verified, ws | AppLayout |
| 14 | `action-items/index.tsx` | GET `/w/{workspace}/action-items` | `workspaces.actionItems.index` | WorkspaceActionItemsController@index :58 | auth+verified, ws | AppLayout |
| 15 | `teams/show.tsx` | GET `/w/{workspace}/teams/{team}` | `teams.show` | TeamsController@show :67 | auth+verified, ws | AppLayout |
| 16 | `teams/integrations.tsx` | GET `/w/{workspace}/teams/{team}/integrations` | `teams.integrations.index` | Integrations\TeamIntegrationsController@index :35 | auth+verified, ws, `EnsureIntegrationProviderEnabled` | AppLayout |
| 17 | `poker/estimates.tsx` | GET `/w/{workspace}/teams/{team}/estimates` | `teams.estimates.index` | TeamEstimatesController@index :50 | auth+verified, ws | AppLayout |
| 18 | `games/index.tsx` | GET `/w/{workspace}/teams/{team}/games` | `teams.games.index` | TeamGameRoomsController@index :30 | auth+verified, ws | AppLayout |
| 19 | `retros/show.tsx` | GET `/retros/{retro}` | `retros.show` | Retros\RetrosController@show :21 | `ResolveRetroParticipant` (no `auth`: members or guest cookie) | none (`null`) |
| 20 | `retros/join.tsx` | GET `/join/{guestToken}` (POST same URI re-renders with `isInvalid`) | `retros.join.show` | RetroJoinsController :27 / :71 | none; POST `throttle:10,1` | AuthLayout |
| 21 | `retros/session-ended.tsx` | (no own route) rendered in place of any `retros/{retro}/*`, `poker/{game}/*`, `games/{room}/*`, `whiteboards/{board}/*` page | n/a | ResolveRetroParticipant.php:54, ResolvePokerPlayer.php:54, ResolveGamePlayer.php:68, ResolveWhiteboardMember.php:54 | n/a | AuthLayout |
| 22 | `poker/show.tsx` | GET `/poker/{game}` | `poker.show` | Poker\PokerGamesController@show :22 | `ResolvePokerPlayer` | none (`null`) |
| 23 | `poker/join.tsx` | GET `/poker/join/{guestToken}` | `poker.join.show` | PokerJoinsController :27 / :74 | none; POST `throttle:10,1` | AuthLayout |
| 24 | `games/show.tsx` | GET `/games/{room}` | `games.show` | Games\GameRoomsController@show :28 | `ResolveGamePlayer` | none (`null`) |
| 25 | `games/join.tsx` | GET `/play/{guestToken}` | `games.join.show` | GameJoinsController :29 / :76 | none; POST `throttle:10,1,game-join` | AuthLayout |
| 26 | `whiteboards/show.tsx` | GET `/whiteboards/{board}` | `whiteboards.show` | Whiteboards\WhiteboardsController@show :21 | `ResolveWhiteboardMember` | none (`null`) |
| 27 | `whiteboards/join.tsx` | GET `/whiteboards/join/{guestToken}` | `whiteboards.join.show` | WhiteboardJoinsController :27 / :72 | none; POST `throttle:10,1` | AuthLayout |
| 28 | `settings/profile.tsx` | GET `/settings/profile` (`/settings` redirects here) | `profile.edit` | Settings\ProfileController@edit :24 | `auth` only (not `verified`) | AppLayout > SettingsLayout |
| 29 | `settings/security.tsx` | GET `/settings/security` | `security.edit` | Settings\SecurityController@edit :50 | auth+verified, `RequirePassword` | AppLayout > SettingsLayout |
| 30 | `settings/appearance.tsx` | GET `/settings/appearance` | `appearance.edit` | `Route::inertia`, routes/settings.php:46 | auth+verified | AppLayout > SettingsLayout |
| 31 | `settings/notifications.tsx` | GET `/settings/notifications` | `notificationPreferences.edit` | Settings\NotificationPreferencesController@edit :17 | auth+verified | AppLayout > SettingsLayout |
| 32 | `settings/api-tokens.tsx` | GET `/settings/api-tokens` | `apiTokens.index` | Settings\ApiTokensController@index :34 | auth+verified, `EnsureMcpIsEnabled`, `RequirePassword` | AppLayout > SettingsLayout |

`GET /dashboard` (`dashboard`, CurrentWorkspaceController@show) has no page: it redirects to `workspaces.show` of the user's current (or first, by name) workspace, or to `workspaces.create` when the user has none.

## B. Layout resolution

Layouts are assigned centrally in `resources/js/app.tsx:48-72` (`createInertiaApp({ layout: (name) => ... })`), not per page:

| Page name | Layout |
|---|---|
| `welcome` | none |
| `retros/join`, `retros/session-ended`, `poker/join`, `games/join`, `whiteboards/join`, `auth/*`, `invitations/*` | `AuthLayout` (layouts/auth-layout.tsx → `auth/auth-simple-layout.tsx`) |
| `retros/show`, `poker/show`, `games/show`, `whiteboards/show` | none (full-screen live pages) |
| `settings/*` | `[AppLayout, SettingsLayout]` (nested) |
| everything else | `AppLayout` (layouts/app-layout.tsx → `app/app-sidebar-layout.tsx`) |

Pages feed layout props through the Inertia v3 static `Page.layout = { ... }` object (e.g. `Login.layout = { title, description }`, `Profile.layout = { breadcrumbs }`) or `setLayoutProps()` at render time (auth/two-factor-challenge.tsx:38). `AuthLayout` translates `title`/`description` itself (`t(title)`, auth-layout.tsx:21) so pages pass English keys.

Global wrappers (app.tsx:74-81): `<TooltipProvider delayDuration={0}>` and `<Toaster />` (sonner; `components/ui/sonner.tsx` calls `useFlashToast()` which listens to the Inertia `flash` router event and shows `flash.toast = {type, message}`). `strictMode: true`. Progress bar colour `#4B5563`. Title template `"<title> - <props.name>"` (app.tsx:42-47). `initializeTheme()` runs on load (app.tsx:88).

### AppLayout shell (every authenticated non-live page)

| Element | File:line | Behaviour / endpoint |
|---|---|---|
| Sidebar (collapsible "icon", variant "inset"), open state from shared prop `sidebarOpen` (cookie `sidebar_state`, unencrypted) | components/app-shell.tsx:12-20, components/ui/sidebar.tsx | client-only; cookie written by the shadcn sidebar |
| Logo link | app-sidebar.tsx:67 | GET `/dashboard` (prefetch) |
| Workspace switcher dropdown: one item per shared `workspaces`, check mark on current, "New workspace" | workspace-switcher.tsx:29-47 | GET `workspaces.show` / GET `workspaces.create` |
| Nav "Teams" | app-sidebar.tsx:27-33 | GET `workspaces.show(currentWorkspace.slug)` or `/dashboard` |
| Nav "Action items" with red badge = `actionItems.overdueAssignedCount` (`99+` cap, aria-label ":count overdue") | app-sidebar.tsx:36-43, nav-main.tsx:34-43 | GET `workspaces.actionItems.index` |
| Nav "Templates" | app-sidebar.tsx:45-51 | GET `workspaces.templates.index` |
| Nav "Members" (only when `currentWorkspace.role !== 'member'`) | app-sidebar.tsx:53-59 | GET `workspaces.members.index` |
| User menu: name+email, "Settings", "Log out" | nav-user.tsx, user-menu-content.tsx:38-62 | GET `profile.edit` (prefetch); POST `/logout` (`router.flushAll()` first) |
| Sidebar trigger + breadcrumbs (translated titles) | app-sidebar-header.tsx:14-15, breadcrumbs.tsx | client-only |
| Notification bell | app-sidebar-header.tsx:18, notification-bell.tsx | see below |

Notification bell (components/notification-bell.tsx), JSON endpoints, hidden when shared `notifications` is null:

| Action | Endpoint | Notes |
|---|---|---|
| Open dropdown → load list | GET `/notifications` (`notifications.index`, NotificationsController@index) → `{notifications: BellNotification[], unreadCount}` (max 30, app/Actions/ActionItems/ListActionItemNotifications.php) | stale responses dropped via request counter; "Loading…", "No notifications.", error + "Retry" states |
| Click a notification | PATCH `/notifications/{notification}` body `{read: true}` → `{unreadCount}` then `router.visit(notification.actionItem.url)` | read mark failure is ignored |
| "Mark all as read" | POST `/notifications/read-all` (`notifications.readAll`) → `{unreadCount: 0}` | disabled when `unread === 0` |
| Window `focus` | `router.reload({ only: ['notifications','actionItems'] })` | refreshes both badges (notification-bell.tsx:45-72) |

Badge shows `9+` above 9; wording keys `overdue` / `due_today` / `due_tomorrow`; relative time via `lib/action-items/format.ts`.

### SettingsLayout (layouts/settings/layout.tsx)
Heading "Settings", side nav: Profile, Security, Appearance, Notifications, plus "API tokens" only when shared `features.mcp` is true (:49-51).

### AuthLayout
Centered card with logo link to `/`, `<h1>` title + description, and a `LanguageSwitcher` at top-right (auth-layout.tsx:18-20).

## C. Shared Inertia props (app/Http/Middleware/HandleInertiaRequests.php:39-65)

| Prop | Shape | Source | Read by |
|---|---|---|---|
| `errors` (+ parent defaults) | validation bag | `parent::share` | forms |
| `name` | string | `config('app.name')` :43 | title template, auth-split-layout |
| `auth.user` | full `User` model serialization or `null` (hidden: password, 2FA secrets, remember_token). Includes `id,name,email,email_verified_at,locale,current_workspace_id,is_instance_admin,action_item_reminders_*,two_factor_confirmed_at,created_at,updated_at`. **No `avatar` attribute is serialized** (the model has `avatarUrl()` but no accessor/appends), although TS `User.avatar?` exists and `user-info.tsx:17` renders it → sidebar avatar always falls back to initials. | :44-46 | nav-user, welcome, settings/profile |
| `sidebarOpen` | bool | cookie `sidebar_state` :47 | app-shell |
| `locale` | string | `app()->getLocale()` :48 | language switcher, `Intl` date formatting |
| `locales` | `['en','fr','es','de']` | `config('skrum.locales')` :49 | language switcher |
| `features` | `{ mcp: bool }` | `config('skrum.mcp.enabled')` :50-52 | settings nav |
| `translations` | `Record<string,string>` (entire `lang/{locale}.json`, ~1.6-1.8k keys, sent on every full page load; lazy closure so partial reloads can skip it) | :53, :70-79 | `useTrans()` |
| `workspaces` | `{id,name,slug}[]` ordered by name (`[]` for guests) | :54-58 | workspace switcher |
| `currentWorkspace` | `{id,name,slug,role}` or null. Uses route `{workspace}` else `user.currentWorkspace`; null if no membership. `role` ∈ owner/admin/member | :59, :89-112 | sidebar, role-gated UI |
| `notifications` | `{unreadCount}` or null (guest) | :60-62 | bell |
| `actionItems` | `{overdueAssignedCount}` or null (guest) | :63, :117-142 | sidebar badge |

Flash data (typed in resources/js/types/global.d.ts:28-32): `toast?: {type: success|info|warning|error, message}`, `invitationUrl?: string`, `newToken?: {name, plainText}`. Set server-side with `Inertia::flash(...)`.

Root template `resources/views/app.blade.php`: `<html lang>` from locale, `dark` class from `appearance` cookie, inline script for system dark mode, `<meta name="reverb-config" content='{"key","host","port","scheme"}'>` (App\Support\ReverbClientConfig), `@fonts` (Bunny "Instrument Sans" 400/500/600 from vite.config.ts), `@vite([... "resources/js/pages/{$page['component']}.tsx"])` (per-page entry: the page path convention is load-bearing).

## D. i18n: a mechanism DOES exist

- Front: `useTrans()` (resources/js/hooks/use-trans.ts) returns `t(key, replacements)`. The key is the English sentence; lookup in shared `translations`, fallback to the key; `:name` placeholders replaced longest-name-first. No pluralisation helper (singular/plural keys are chosen by hand, e.g. notification-bell.tsx:158-166).
- Files: `lang/en.json` (1597 lines), `lang/fr.json`, `lang/es.json`, `lang/de.json` (1841 lines each); PHP groups `lang/{en,fr,es,de}/templates.php` and `whiteboards.php` (server-side template names/columns); `lang/fr|es|de/{auth,validation,passwords,pagination,actions,http-statuses}.php`.
- Locale resolution `App\Http\Middleware\SetLocale`: `user.locale` → `locale` cookie → `Accept-Language` → `app.locale` → `en`.
- Switch: `components/language-switcher.tsx` → `router.put('/locale', {locale})` (`locale.update`, LocalesController@update; no auth required; saves `users.locale` when signed in and sets a forever `locale` cookie). Mounted in AuthLayout and `settings/appearance`.
- Guard rail: `tests/Feature/TranslationKeysTest.php` statically scans `resources/js/{pages,components,layouts,hooks,lib}` and `app/` for `t('…')`, `t("…")`, `__('…')` (plus ternaries inside the call) and fails if any key is missing from any of the 4 locale files. **A rewrite must keep calling a function literally named `t(` with string-literal keys inside those directories** (or the test must be updated). Keys passed through variables are declared in constant maps with a comment (e.g. notification-bell.tsx:38-43).
- Server-rendered labels arrive already translated in props in several places (e.g. `expirationOptions[].label`, SSO provider labels, Fortify `status`).
- Hardcoded/untranslated strings noticed in my slice: `'Laracasts'` (welcome.tsx:103), `'Claude Code'` tab label (new-token-dialog.tsx:118), error strings `'Failed to fetch QR code'`, `'Failed to fetch a setup key'`, `'Failed to fetch recovery codes'` (hooks/use-two-factor-auth.ts:58,71,82), passkey default name `"<browser> on <os>"` (passkey-register.tsx:35), `skrum_…` token hint prefix (api-tokens.tsx:182).

## E. Realtime infrastructure (shared)

- Echo configured once in `resources/js/app.tsx:13-39` with `@laravel/echo-react` `configureEcho({ broadcaster: 'reverb', key, wsHost, wsPort, wssPort, forceTLS, enabledTransports: ['ws','wss'] })`; connection read from the `reverb-config` meta tag (lib/reverb-config.ts); if no key, Echo is not configured and live pages must degrade.
- Channel auth uses a **custom handler** posting to `POST /broadcasting/auth` (`broadcasting.auth`, BroadcastAuthorizationsController@store) through the Inertia http client (so cookies + CSRF apply and guests with a guest cookie can authorize). There is no `routes/channels.php`; that controller is the only authorizer (returns 403 for anything else).
- Channels it authorizes (app/Http/Controllers/BroadcastAuthorizationsController.php:39-66):

| Channel | Type | Who | Presence member info |
|---|---|---|---|
| `presence-retro.{retroId}` | presence | resolved retro participant (member or guest cookie) | `{id: participantId, name, avatarUrl, isGuest}` |
| `private-participant.{participantId}` | private | only that participant | n/a |
| `private-retro-members.{retroId}` | private | non-guest retro participants | n/a |
| `presence-poker.{gameId}` | presence | resolved poker player | `{id, name, avatarUrl, isGuest}` |
| `presence-game.{roomId}` | presence | game player; standalone rooms only (403 for icebreaker rooms, which play on the retro channel); 403 "This room is full." above `GameRoom::MaxOnlinePlayers` distinct online players | `{id, name, avatarUrl, isGuest}` |
| `presence-whiteboard.{boardId}` | presence | resolved whiteboard member | `{id, name, avatarUrl, isGuest}` |
| `private-team-action-items.{teamId}` | private | authenticated user who `can('view', team)`; never a guest | n/a |

- Client events (whispers): `lib/realtime/whisper-transport.ts` wraps `channel.whisper(event, data)` / `listen('.client-<event>')`; Reverb is configured `accept_client_events_from => 'members'` (config/reverb.php:90) and stamps `user_id`, which the transport uses as the trusted sender id. Max message size 10 000 bytes (config/reverb.php:89).
- `lib/realtime/realtime-state.ts`: `data-realtime="connecting|connected"` attribute rendered on the root of the live pages (retro/board.tsx:230, poker/game.tsx:70, games/game-room.tsx:46, pages/action-items/index.tsx:562). The browser test harness waits on `[data-realtime="connected"]` (tests/Browser/Support/InteractsWithBrowser.php `awaitRealtime`) and on a `/snapshot` resource fetch after subscription (`awaitResync`).
- JSON mutations go through `retroRequest()` (lib/retro/api.ts): Inertia http client, `Accept: application/json`, `X-Socket-ID` header (so `toOthers()` broadcasts skip the sender), 15 s timeout, errors normalised to `RetroRequestError(status, firstValidationMessage, errors)`.
- Per-domain channel/event tables are in the retro, poker, games, whiteboard and action-items sections.

## F. Non-Inertia endpoints the front calls (global list; detail in each section)

Almost every mutation on the four live pages and on the action-items page is a JSON call (not an Inertia visit). Families:

| Family | Endpoints |
|---|---|
| Broadcasting | POST `/broadcasting/auth` |
| Notifications | GET `/notifications`, PATCH `/notifications/{id}`, POST `/notifications/read-all` |
| 2FA (Fortify, via `useHttp`) | GET `/user/two-factor-qr-code`, `/user/two-factor-secret-key`, `/user/two-factor-recovery-codes` |
| Passkeys (`@laravel/passkeys/react`) | GET `/passkeys/login/options`, POST `/passkeys/login`, GET `/passkeys/confirm/options`, POST `/passkeys/confirm`, GET `/user/passkeys/options`, POST `/user/passkeys` (library default URLs; only `confirm*` and `destroy` are imported through Wayfinder) |
| Assets served by the app | GET `/avatars/{seed}.svg` (URLs arrive in props/presence as `avatarUrl`), GET `/gifs/{gif}/{size}` (`preview|full`, proxied GIFs, throttle 240/min; URLs built server-side), GET `/emoji-data/{version}/{locale}/{file}` (self-hosted emojibase for the frimousse picker, `emojibaseUrl` passed in retro/emoji-picker.tsx:143, throttle 120/min) |
| Retro | everything under `/retros/{retro}/…` except the page GET (snapshot, phase, timer, highlight, settings, guest-token, facilitator, roti, health-check, columns, column-order, cards, position, group, group-name, group-name-suggestions, votes, reactions, comments, action-items(+comments, subtasks, exports, exports/preview, external-links sync), summary, shares, results-email, suggested-actions, survey-drafts, surveys(+closure, response, reactions, comments), gifs search) |
| Poker | everything under `/poker/{game}/…` except the page GET (snapshot, tasks, task-order, current-task, rounds vote/reveal/auto-reveal/timer, tasks rounds/estimate/sync/estimate-conflict, settings, saved-decks, status, guest-token, shares, imports containers/iterations/preview/refresh/store, facilitator, players spectator) |
| Games | everything under `/games/{room}/…` except the page GET (snapshot, update, guest-token, host, game switch, rounds, rounds/{round}, timer, scores, shares, pass, letters, secret, hints, guesses, drawing-ops, drawing-ops/last, drawing, clue, question, answer, reveal, vote, close, gifs search) |
| Whiteboard | everything under `/whiteboards/{board}/…` except the page GET (snapshot, settings, guest-token, facilitator, timer, elements GET/PUT, files POST/GET via raw `fetch` in lib/whiteboard/files.ts:43,77, template, duplicate) |
| Workspace action items | `/w/{workspace}/action-items…` comments, subtasks, exports/preview, exports, external-links sync (lib/action-items/endpoints.ts) |
| Team integrations | `/w/{workspace}/teams/{team}/integrations/…` user-mappings, accounts, priorities, statuses, targets, detection, test, webhook, secret, deliveries, redelivery, telegram code, jira-dc token |

## G. Routes with no front-end caller

Computed by matching every route of `php artisan route:list --json` (292 routes) against Wayfinder imports in `resources/js` (excluding generated `actions/`, `routes/`, `wayfinder/`). 36 routes have no detected caller; excluding framework/dev routes (`up`, `storage/*`, `sanctum/csrf-cookie`, `_boost/*`, `_inertia/devtools/*`, `mcp`) and GET page routes reached by plain navigation or server redirects, what remains:

| Route | Why no caller |
|---|---|
| GET `/games/{room}/rounds` (`games.rounds.index`, Games\GameRoundsController@index) | **the only app JSON endpoint with no front caller detected** (see games section for confirmation) |
| GET `/auth/{provider}/callback` (`sso.callback`) | IdP redirect target |
| GET `/integrations/{provider}/callback`, GET `/integrations/jira-dc/callback` | OAuth redirect targets |
| POST `/integrations/webhooks/{source}` and `/{source}/{integration}/{token}` (routes/webhooks.php, outside the web group) | inbound provider webhooks |
| GET `/avatars/{seed}.svg`, `/gifs/{gif}/{size}`, `/emoji-data/...` | used via server-built URLs, not Wayfinder |
| GET `/.well-known/passkey-endpoints` | browser/password-manager discovery |
| `/mcp` (GET/POST/DELETE, routes/ai.php) | MCP server for external AI clients, no UI besides the API-tokens page |
| Fortify GET pages (`email/verify`, `email/verify/{id}/{hash}`, `reset-password/{token}`, `two-factor-challenge`, `user/confirm-password`), `user/confirmed-password-status`, passkey login/registration endpoints | reached by redirects, emailed links or the passkeys library |
| GET join pages (`join/{guestToken}`, `poker/join/…`, `play/…`, `whiteboards/join/…`), `invitations/{token}` | reached from copied links (URLs are built server-side and shown in dialogs) |
| ANY `/settings` | redirect to `/settings/profile` |

The full route→caller matrix is in `scratchpad/route-callers.tsv` (tab-separated: method, URI, name, action, front files that import it).

## H. Test and tooling setup

| Topic | Finding |
|---|---|
| PHP tests | Pest 5 (`pestphp/pest ^5.2`, plugins browser/drift/laravel/rector). Suites in phpunit.xml: Unit, Feature, Arch. `tests/Pest.php` binds `TestCase`+`RefreshDatabase` to `Feature` and `BrowserTestCase`+`RefreshDatabase` to `Browser`; `pest()->browser()->timeout(20_000)`. |
| Browser tests | `tests/Browser/` (not in phpunit.xml suites; run by path): `Smoke/` (AssetCheck, Harness, KeyboardDrag, QueuedBroadcast, Realtime), `Walkthroughs/` (26 files, Plan04 … Plan15), `Support/` (`InteractsWithBrowser`, `ReverbServer`). ~17 400 lines. Run with `composer test:browser` (= `npm run build` then `pest tests/Browser`); needs built assets and no `public/hot`; starts a real Reverb server; Playwright Chromium (`playwright ^1.63` devDependency). CI job `browser` in .github/workflows/tests.yml uses Postgres 18. |
| What browser tests bind to | Visible English text (`click('Join')`, `assertSee`), `[role=…]` (334 selector uses), `[aria-label=…]` (217+), element ids (`#email`, `#password`, `#name`, `#new-retro-title`, `#retro-locked`, `#poker-task-title`, `#token-name`, `#survey-kind`, `#completed-tab-board`, `#deck-custom-cards`, `#retro-hide-vote-counts`, `#poker-guest-link-access`, `#new-retro-icebreaker`, …), `data-test="login-button"` (`@login-button`), `[data-realtime]`, `img[data-presence-id]`, `.lc-overlay` (live-cursors), `button[frimousse-emoji]`, `canvas[aria-label]`, keyboard DnD via `aria-pressed` on dnd-kit handles (`dragWithKeyboard`). **These are a de-facto contract for the rewrite.** Other `data-test` attributes: update-profile-button, update-password-button, sidebar-menu-button, retro-sort-by-votes, retro-action-items-panel, reset-password-button, register-user-button, poker-task-row, logout-button, email-password-reset-link-button, delete-user-button, confirm-password-button, confirm-delete-user-button; `data-testid="toolbar-eraser"`. |
| Whiteboard browser coverage | None: there is no Plan17 file under tests/Browser/Walkthroughs; only manual walkthrough docs `docs/superpowers/walkthroughs/plan-17a…17d-*.md`. |
| Arch tests | `tests/Arch/ArchTest.php` (PHP presets + layering rules), `tests/Arch/BrowserTestRulesTest.php` (forbids `actingAs`, injected cookies and blanket event fakes in browser tests). |
| JS unit tests | **None.** No `*.test.*`/`*.spec.*` under `resources/` or `tests/`, no vitest config, no `test` script in package.json. The `vitest` and `vp` binaries exist in node_modules only because `vite-plus` ships them, so `vp test` is available but has nothing to run. |
| JS lint/format | `npm run check` = `vp check` (oxlint + oxfmt through vite-plus; config in vite.config.ts `lint` with `denyWarnings: true`, `typeAware: true`, and `fmt`: 4 spaces, single quotes, width 80, Tailwind class sorting). `npm run check:fix` = `vp check --fix`. `npm run types:check` = `tsc --noEmit`. Lint ignores `resources/js/{actions,routes,wayfinder}/**` and `resources/js/components/ui/*`. No ESLint, no Prettier config. |
| PHP lint | `composer lint` (pint --parallel), `composer lint:check`, `composer types:check` (phpstan), `composer rector` / `rector:check`. |
| CI entry | `composer ci:check` = `npm run check` + `npm run types:check` + `composer test` (config:clear, pint --test, phpstan, `php artisan test`). |
| knip | **No knip config and no knip dependency** (no `knip.json`, `knip.ts`, nor a `knip` key in package.json). |
| Build | `vp build`; SSR script exists (`build:ssr`) but `config/inertia.php` has `ssr.enabled` = `env('INERTIA_SSR_ENABLED', false)` and there is no `resources/js/ssr.tsx`. React Compiler is enabled (babel `reactCompilerPreset`, vite.config.ts:23-25). Wayfinder plugin with `formVariants: true` (the `.form()` helpers used with `<Form>`). |
| Design docs | `docs/design-system/` (README, tokens.json, app.css, components, sections, logos, PROMPT-CLAUDE-CODE.md) exists alongside `resources/css/app.css` (214 lines). |

## I. Dead code found (never imported)

Computed by resolving every import in `resources/js` (excluding generated dirs):

- `layouts/app/app-header-layout.tsx` → and therefore `components/app-header.tsx` (251 lines, still contains Laravel starter-kit links to `github.com/laravel/react-starter-kit` and a Search button with no handler).
- `layouts/auth/auth-card-layout.tsx`, `layouts/auth/auth-split-layout.tsx`.
- `components/nav-footer.tsx`, `components/ui/icon.tsx`, `components/ui/placeholder-pattern.tsx`.


---

<!-- part: 08-auth-settings-welcome -->

# Welcome, auth and settings pages

None of the pages in this part subscribes to any Echo channel (verified: no `useEcho`/`echo()` import in these pages or in the components they mount). Shared shell behaviour (sidebar, notification bell, language switcher) is in the cross-cutting part.

Fortify features enabled (config/fortify.php:163-175): registration, resetPasswords, emailVerification, twoFactorAuthentication (`confirm: true`, `confirmPassword: true`), passkeys (`confirmPassword: true`). `home` = `/dashboard`. Rate limiters: `login` 5/min per email+IP, `two-factor` 5/min, `passkeys` 10/min (FortifyServiceProvider.php:102-112).

## pages/welcome.tsx

1. **Route**: GET `/` (`home`), closure routes/web.php:166. No auth.
2. **Props**: `canRegister: boolean` = `SignupGate::canShowRegistration()` (true for the first user ever, or when `SKRUM_SIGNUP_MODE` is not `invite`). Reads shared `auth.user`.
3. **Layout**: none.
4. **Actions**:

| Action | Element | Target |
|---|---|---|
| "Dashboard" (signed in) | welcome.tsx:21-26 | GET `/dashboard` |
| "Log in" (guest) | :29-34 | GET `/login` |
| "Register" (guest, only if `canRegister`) | :35-42 | GET `/register` |
| External links "Documentation", "Laracasts", "Deploy now" | :67, :98, :124 | laravel.com/docs, laracasts.com, cloud.laravel.com |

5. **Realtime**: none.
6. **Conditional UI**: `auth.user` and `canRegister` only.
7. **Notes**: this is still the **stock Laravel starter-kit welcome page** (Laravel logo SVG, "Let's get started", "Laravel has an incredibly rich ecosystem."), merely passed through `t()`. It has no product content and no language switcher. Hard-coded colours, not design tokens.

## pages/auth/login.tsx

1. **Route**: GET `/login` (`login`), Fortify view FortifyServiceProvider.php:54. `guest`.
2. **Props** (TS type matches): `canResetPassword: bool` (Fortify feature), `canRegister: bool` (`SignupGate::canShowRegistration($followedInvitation)`: also true when the session holds a pending `invitation_token`), `status?: string` (session flash, e.g. password reset confirmation), `ssoProviders: {key: 'google'|'github'|'entra'|'oidc', label: string}[]` (`SsoProvider::options()`, only providers whose config keys are set).
3. **Layout**: AuthLayout, `Login.layout = { title: 'Log in to your account', description: … }`.
4. **Actions**:

| Action | Element | Endpoint |
|---|---|---|
| Sign in with a passkey (hidden if WebAuthn unsupported) | `<PasskeyVerify />` login.tsx:37, components/passkey-verify.tsx | `@laravel/passkeys/react` `usePasskeyVerify()` default routes: GET `/passkeys/login/options`, POST `/passkeys/login`; on success `router.visit(response.redirect ?? '/dashboard')` |
| Email + password + "Remember me" submit | `<Form {...store.form()}>` :39-125 | POST `/login` (`login.store`); `resetOnSuccess={['password']}`; errors on `email`, `password` |
| Show/hide password | components/password-input.tsx:24-38 | client-only |
| "Forgot your password?" (if `canResetPassword`) | :69-77 | GET `/forgot-password` |
| "Continue with :provider" per SSO provider (plain `<a>`, full navigation) | components/sso-buttons.tsx:27-35 | GET `/auth/{provider}/redirect` (`sso.redirect`, 404 if provider disabled; failures come back to `/login` with an `email` error) → IdP → GET `/auth/{provider}/callback` → `/two-factor-challenge` if 2FA confirmed, else intended URL or `/dashboard` |
| "Sign up" (if `canRegister`) | :115-122 | GET `/register` |
| Language switcher (AuthLayout) | | PUT `/locale` |

6. **Conditional UI**: `canResetPassword`, `canRegister`, `ssoProviders.length`, passkey support.
7. **Notes**: `status` banner is rendered below the form. Explicit `tabIndex` order 1-5. `data-test="login-button"` is used by the browser harness (`@login-button`), as are `#email` / `#password`.

## pages/auth/register.tsx

1. **Route**: GET `/register` (`register`), FortifyServiceProvider.php:75-85; 403 when registration cannot be shown. `guest`.
2. **Props**: `passwordRules: string` (`Password::defaults()->toPasswordRulesString()`, fed to the `passwordrules` attribute for password managers), `invitationEmail: string|null` (email of the pending invitation followed in this session), `ssoProviders` (as login).
3. **Layout**: AuthLayout (`title: 'Create an account'`).
4. **Actions**: `<Form {...store.form()} disableWhileProcessing resetOnSuccess={['password','password_confirmation']}>` → POST `/register` (`register.store`, `App\Actions\Fortify\CreateNewUser`, which consumes the session `invitation_token`); fields name, email, password, password_confirmation; SSO buttons; "Log in" link → `/login`; show/hide password; language switcher.
6. **Conditional UI**: when `invitationEmail !== null` the email input is prefilled and `readOnly` (register.tsx:69-70).

## pages/auth/forgot-password.tsx

1. **Route**: GET `/forgot-password` (`password.request`). `guest`.
2. **Props**: `status?: string`.
3. **Layout**: AuthLayout.
4. **Actions**: `<Form {...email.form()}>` → POST `/forgot-password` (`password.email`); "log in" link → `/login`; language switcher. `status` shown above the form in green.

## pages/auth/reset-password.tsx

1. **Route**: GET `/reset-password/{token}` (`password.reset`). `guest`.
2. **Props**: `token: string` (route param), `email: string` (query `?email=`), `passwordRules: string`.
3. **Layout**: AuthLayout.
4. **Actions**: `<Form {...update.form()} transform={(data) => ({...data, token, email})}>` → POST `/reset-password` (`password.update`); email input is read-only; password + confirmation with show/hide.

## pages/auth/verify-email.tsx

1. **Route**: GET `/email/verify` (`verification.notice`). `auth`. Reached by the `verified` middleware redirect.
2. **Props**: `status?: string` (`'verification-link-sent'` shows the confirmation text).
3. **Layout**: AuthLayout.
4. **Actions**: "Resend verification email" `<Form {...send.form()}>` → POST `/email/verification-notification` (`verification.send`); "Log out" `TextLink href={logout()}` → POST `/logout`. The emailed link hits GET `/email/verify/{id}/{hash}` (`verification.verify`).

## pages/auth/two-factor-challenge.tsx

1. **Route**: GET `/two-factor-challenge` (`two-factor.login`). `guest` (pending login in session). Also the SSO callback redirects here.
2. **Props**: none.
3. **Layout**: AuthLayout; title/description set dynamically with `setLayoutProps()` (two-factor-challenge.tsx:38-41) depending on the mode.
4. **Actions**:

| Action | Element | Endpoint |
|---|---|---|
| Enter 6-digit code (`InputOTP`, digits only, `OTP_MAX_LENGTH = 6`) and "Continue" | :78-110 | POST `/two-factor-challenge` (`two-factor.login.store`) with `code` |
| Toggle "login using a recovery code" / "login using an authentication code" | :114-122 | client-only; clears errors and code |
| Enter recovery code and "Continue" | :64-73 | POST `/two-factor-challenge` with `recovery_code` |

7. `resetOnError`, `resetOnSuccess={!showRecoveryInput}`.

## pages/auth/confirm-password.tsx

1. **Route**: GET `/user/confirm-password` (`password.confirm`). `auth`. Reached via `RequirePassword` on `/settings/security` and `/settings/api-tokens` (GET and POST) and by Fortify for 2FA/passkey management.
2. **Props**: none.
3. **Layout**: AuthLayout.
4. **Actions**: "Confirm with passkey" (`PasskeyVerify` with explicit routes GET `/passkeys/confirm/options`, POST `/passkeys/confirm`; then `router.visit(response.redirect ?? '/dashboard')`); password form `<Form {...store.form()} resetOnSuccess={['password']}>` → POST `/user/confirm-password` (`password.confirm.store`).

## pages/settings/profile.tsx

1. **Route**: GET `/settings/profile` (`profile.edit`), ProfileController@edit :24. `auth` only (an unverified user can reach it). `/settings` redirects here.
2. **Props**: `mustVerifyEmail: bool` (User implements `MustVerifyEmail` → always true), `status?: string`. Reads shared `auth.user` (name, email, email_verified_at).
3. **Layout**: AppLayout > SettingsLayout; `Profile.layout = { breadcrumbs: [{title:'Profile settings', href}] }`.
4. **Actions**:

| Action | Element | Endpoint |
|---|---|---|
| Save name + email | `<Form {...ProfileController.update.form()}>` profile.tsx:42-131 | PATCH `/settings/profile` (`profile.update`); changing the email resets `email_verified_at`; flash toast "Profile updated."; redirect back to `profile.edit` |
| "Click here to re-send the verification email." (only if `mustVerifyEmail && email_verified_at === null`) | :99-107 (`Link as="button"`) | POST `/email/verification-notification` |
| "Delete account" → dialog with password → confirm | components/delete-user.tsx | DELETE `/settings/profile` (`profile.destroy`, route is `auth`+`verified`); validates current password (ProfileDeleteRequest also refuses when the user is the sole owner of a workspace that has other members, app/Http/Requests/Settings/ProfileDeleteRequest.php); deletes workspaces where the user is the only member, tokens, the user; logs out; redirects to `/` |

## pages/settings/security.tsx

1. **Route**: GET `/settings/security` (`security.edit`), SecurityController@edit :50. auth+verified + `RequirePassword` (password or passkey confirmation first).
2. **Props** (SecurityController.php:21-48): `passwordRules: string`; `canManageTwoFactor: bool`; `canManagePasskeys: bool`; `passkeys: {id, name, authenticator: string|null, created_at_diff, last_used_at_diff: string|null}[]` (`[]` when passkeys are off); when 2FA is manageable also `twoFactorEnabled: bool` and `requiresConfirmation: bool` (TS marks all of these optional, matching the conditional keys).
3. **Layout**: AppLayout > SettingsLayout.
4. **Actions**:

| Action | Element | Endpoint |
|---|---|---|
| Update password (current, new, confirm) | security.tsx:42-130 | PUT `/settings/password` (`user-password.update`, throttle 6/min); `resetOnSuccess`, `resetOnError` on the 3 fields, focus moves to the invalid field; toast "Password updated." |
| "Enable 2FA" | components/manage-two-factor.tsx:102-111 | POST `/user/two-factor-authentication` (`two-factor.enable`), then opens the setup modal |
| Setup modal: loads QR + key | two-factor-setup-modal.tsx:317-321, hooks/use-two-factor-auth.ts (Inertia `useHttp`) | GET `/user/two-factor-qr-code` → `{svg,url}`, GET `/user/two-factor-secret-key` → `{secretKey}` |
| Copy setup key | two-factor-setup-modal.tsx:128-133 | clipboard (`useClipboard`), icon turns into a check |
| "Continue" → verification step (when `requiresConfirmation`) → 6-digit OTP → "Confirm" / "Back" | :144-234 | POST `/user/confirmed-two-factor-authentication` (`two-factor.confirm`); error key `confirmTwoFactorAuthentication.code` |
| "Continue setup" (setup data already fetched but modal closed) | manage-two-factor.tsx:96-100 | client-only |
| "Disable 2FA" | :68-78 | DELETE `/user/two-factor-authentication` (`two-factor.disable`) |
| "View recovery codes" / "Hide recovery codes" | two-factor-recovery-codes.tsx:73-86 | GET `/user/two-factor-recovery-codes` (also fetched on mount) |
| "Regenerate codes" (only while codes are visible) | :88-105 | POST `/user/two-factor-recovery-codes` (`two-factor.regenerate-recovery-codes`) then refetch |
| "Add passkey" → name form (default name `"<Browser> on <OS>"` from the user agent) → "Register passkey" / "Cancel" | components/passkey-register.tsx | `usePasskeyRegister()` default routes GET `/user/passkeys/options`, POST `/user/passkeys`; then `router.reload()` |
| Remove passkey (trash icon → confirm dialog) | components/passkey-item.tsx, manage-passkeys.tsx:35-40 | DELETE `/user/passkeys/{passkey}` (`passkey.destroy`) |

6. **Conditional UI**: `canManageTwoFactor` hides the whole 2FA block; `canManagePasskeys` hides passkeys; "Passkeys are not supported in this browser." when WebAuthn is missing; `twoFactorEnabled` switches enable/disable; `requiresConfirmation` adds the OTP step.
7. **Notes**: the QR SVG is injected with `dangerouslySetInnerHTML` and inverted in dark mode (two-factor-setup-modal.tsx:82-92). `SecurityController@edit` calls `ensureStateIsValid()` (clears a half-finished 2FA setup). Empty state for passkeys; skeleton lines while recovery codes load.

## pages/settings/appearance.tsx

1. **Route**: GET `/settings/appearance` (`appearance.edit`), `Route::inertia` routes/settings.php:46. auth+verified.
2. **Props**: none (reads shared `locale`, `locales` through the switcher).
3. **Layout**: AppLayout > SettingsLayout.
4. **Actions**:

| Action | Element | Effect |
|---|---|---|
| Theme Light / Dark / System | components/appearance-tabs.tsx | client-only: `localStorage['appearance']` + cookie `appearance` (1 year, read by `HandleAppearance` for the SSR `dark` class) + toggles `html.dark` and `color-scheme`; follows the OS when "system" (hooks/use-appearance.tsx) |
| Language select (English, Français, Español, Deutsch) | components/language-switcher.tsx | PUT `/locale` `{locale}` with `preserveScroll` |

## pages/settings/notifications.tsx

1. **Route**: GET `/settings/notifications` (`notificationPreferences.edit`), NotificationPreferencesController@edit :17. auth+verified.
2. **Props**: `preferences: {action_item_reminders_by_email: bool, action_item_reminders_in_app: bool}`, `reminderTime: string` (config, default `08:00`), `remindersEnabled: bool` (instance config).
3. **Layout**: AppLayout > SettingsLayout.
4. **Actions**: two checkboxes + "Save" (`useForm`) → PATCH `/settings/notifications` (`notificationPreferences.update`), toast "Notification settings saved.".
6. **Conditional UI**: "Reminders are turned off on this instance." when `!remindersEnabled` (the form stays usable).

## pages/settings/api-tokens.tsx

1. **Route**: GET `/settings/api-tokens` (`apiTokens.index`), ApiTokensController@index :34. auth+verified + `EnsureMcpIsEnabled` + `RequirePassword`. Nav entry only when shared `features.mcp`.
2. **Props** (TS matches): `tokens: {id, name, hint, scopes: ('mcp:read'|'mcp:write'|'mcp:delete')[], team: {id,name}|null, teamAccessible: bool, createdAt, expiresAt, lastUsedAt: ISO|null, isExpired: bool}[]` (latest first); `teams: {workspace:{id,name}, teams:{id,name}[]}[]` (teams visible to the user, grouped by workspace); `mcpUrl: string` (`url('/mcp')`); `expirationOptions: {value: '30_days'|'90_days'|'1_year'|'never', label (translated server-side)}[]`; `defaultExpiration: '90_days'`. Flash `newToken: {name, plainText}` after creation.
3. **Layout**: AppLayout > SettingsLayout. Note: this page sets **no** `layout` breadcrumbs object, unlike the other settings pages.
4. **Actions**:

| Action | Element | Endpoint |
|---|---|---|
| Copy server URL (input selects itself on focus) | api-tokens.tsx:59-67, :96-102 | clipboard; toast "Link copied" or error |
| "Create token" dialog: name (max 60, unique per user), permissions (Read always on and disabled; "Create and update" = `mcp:write`; "Delete my messages" = `mcp:delete`), team ("All my teams" or one team, grouped by workspace), expiration | components/settings/create-token-dialog.tsx | POST `/settings/api-tokens` (`apiTokens.store`, `RequirePassword`, throttle 10/min) body `{name, scopes[], team_id|null, expiration}` |
| New-token dialog (opens from flash; cannot be dismissed by Escape or outside click): copy token, tabs "Claude Code" / "Other clients (JSON)" showing a ready-made config snippet, "Copy configuration", "Done" | components/settings/new-token-dialog.tsx | client-only; the plain token is only ever in the flash payload |
| "Revoke" per row → confirm dialog | components/settings/revoke-token-dialog.tsx (uses components/confirm-form-dialog.tsx) | DELETE `/settings/api-tokens/{token}` (`apiTokens.destroy`), toast "Token revoked." |

6. **Conditional UI**: expired rows are muted with an "Expired" badge; "No access to this team anymore" when `!teamAccessible`; empty state "No API tokens yet.".
7. **Notes**: dates formatted with `Intl.DateTimeFormat(locale, {dateStyle: 'medium'})`; null → "Never".

## Slice notes

- JSON endpoints: the 2FA GETs, the passkey endpoints, `/notifications*` (shell), all listed above.
- `auth.user.avatar` is never provided by the backend, so the user avatar in the sidebar is always the initials fallback.
- Could not verify: the exact default URLs used by `@laravel/passkeys/react` `usePasskeyVerify()`/`usePasskeyRegister()` when no `routes` option is passed (inferred from the vendor route list: `passkeys/login/options`, `passkeys/login`, `user/passkeys/options`, `user/passkeys`; I did not read the library source). The post-login/registration redirect responses (Fortify defaults to `/dashboard`; `CreateNewUser` clears `invitation_token` and `url.intended`) were not traced further.


---

<!-- part: 07-workspace-action-items -->

# Slice 07: workspace pages, global action items, members, templates, invitations

Paths are relative to `/Users/aritti/Projects/skrum`. `resources/js/` is abbreviated `js/`.

Common to every route under `w/{workspace}` (routes/web.php:214-363): middleware `auth`, `verified` (group at web.php:196), `can:view,workspace` (`WorkspacePolicy::view` = `User::belongsToWorkspace`, app/Policies/WorkspacePolicy.php:11) and `RememberCurrentWorkspace` (app/Http/Middleware/RememberCurrentWorkspace.php:21 writes `users.current_workspace_id` on every request to a workspace URL when it differs), plus `scopeBindings()`. `{workspace}` binds by **slug** (front always passes `workspace.slug`).

Role vocabulary: `WorkspaceRole` = `owner | admin | member` (app/Enums/WorkspaceRole.php). "Manager" = owner or admin (`User::canManage`, app/Models/User.php:120). Team visibility: managers see every team, members only teams they belong to (`Workspace::teamsVisibleTo`, app/Models/Workspace.php:82; `TeamPolicy::view`, app/Policies/TeamPolicy.php:11).

Layout resolution is central, in `js/app.tsx:48-72`: `invitations/*` -> `AuthLayout`; everything else in this slice -> `AppLayout` (default branch). No page in this slice sets `Page.layout`.

---

## pages/action-items/index.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/action-items` | `workspaces.actionItems.index` | GET | `WorkspaceActionItemsController@index` (`Inertia::render` at app/Http/Controllers/WorkspaceActionItemsController.php:58) | common group |

Query string (parsed by `ActionItemFilters::fromRequest`, app/Actions/ActionItems/ActionItemFilters.php:25; unknown values silently fall back to defaults, never a validation error):

- `status`: `open` (default) | `overdue` | `completed` | `all`
- `assignee`: `me` | `unassigned` | a user UUID (anything else -> null = anyone)
- `team`: a team UUID that is among the viewer's visible teams (else null)
- `item`: an action item UUID (deep link; see "focused item")
- `page`: Laravel paginator page, 50 per page (`ActionItemQuery::PerPage`), `withQueryString()`

Server-generated deep links to this page (must keep working): `?item={id}` from in-app notifications (app/Actions/ActionItems/ListActionItemNotifications.php:99), reminder digest mail (app/Notifications/ActionItemReminderDigestNotification.php:62,107), MCP presenter (app/Mcp/Presenters/McpActionItem.php:36), outgoing webhook payloads (app/Actions/Integrations/BuildWebhookEventData.php:96), exported tracker issue back-link (app/Actions/Integrations/BuildIssueDraft.php:30); `?team={id}` from the board snapshot (app/Actions/Retros/BuildBoardSnapshot.php:173) and from `js/pages/teams/show.tsx:110`. Sidebar entry "Action items" with the overdue badge: `js/components/app-sidebar.tsx:37-42`.

### 2. Props (controller lines 58-82 vs TS `Props` at index.tsx:58-81)

| Prop | Shape | Built by | Notes |
|---|---|---|---|
| `workspace` | `{id, name, slug}` | controller:59 | = `WorkspaceSummary` |
| `filters` | `{status, assignee: ?string, team: ?string, item: ?string}` | `ActionItemFilters::toArray` (ActionItemFilters.php:48) | matches |
| `items` | `{data: ActionItem[], currentPage, lastPage, total, prevPageUrl, nextPageUrl}` | closure, controller:61 -> `items()` :148, `ActionItemQuery::forUser` (app/Actions/ActionItems/ActionItemQuery.php:19), rows via `PresentActionItem::many` | Closure prop: always evaluated on full visits, and it is in the partial-reload list. `total` is sent but never read by the page |
| `focusedItem` | `ActionItem \| null` | closure, controller:62 -> `focusedItem()` :165 (`ActionItemQuery::find`, visibility-scoped) | non-null only when `?item=` resolves to a visible item |
| `teams` | `Array<{id, name, members: Array<{id, name, avatarUrl}>}>` | `presentTeams` :180 over `teamsVisibleTo` | members ordered by name |
| `creatableTeams` | same shape | controller:64 | only teams the viewer is a **member** of (a manager who is not in a team cannot create there) |
| `assignees` | `Array<{id, name}>` | controller:65-69 | distinct members of all visible teams, sorted by name |
| `realtimeTeamIds` | `string[]` | controller:70 | all visible team ids, or just `[filters.team]` when a team filter is active |
| `exportSources` | `Record<teamId, Array<{source, label, integrationId}>>` | `ListExportSources::forTeams` (app/Actions/Integrations/ListExportSources.php:44) | `[]` (empty array, not object) when no integration provider is enabled; only tracker integrations that are enabled and `canWrite()` |
| `viewer` | `{userId, isWorkspaceManager, facilitatedRetroIds: string[], reviewTeamIds: string[]}` | controller:72-81 | `facilitatedRetroIds` = retros of visible teams whose facilitator participant is this user; `reviewTeamIds` = team ids of those retros that are not `Completed` |

`ActionItem` shape = `PresentActionItem::handle` (app/Actions/Retros/PresentActionItem.php:44) = TS `ActionItem` (js/lib/retro/types.ts:203): `id, retroId, teamId, content, priority (high|medium|low), dueOn (Y-m-d|null), isOverdue, status (open|completed), completedAt, completedVia (tracker key|null), assignee {kind: member|guest, id, name, avatarUrl, isTeamMember}|null, createdBy {name, avatarUrl}|null, isMine, commentCount, source {retroTitle, retroCreatedAt, retroUrl}|null, themeId, themeName, recurrence (weekly|every_two_weeks|monthly|null), previousOccurrenceId, subtasks [{id, content, isCompleted, position}], createdAt, externalLinks [{id, source, key, url, state (open|done|null), statusName, syncState (off|synced|pending|failed|missing), syncError, lastSyncedAt}] | null`. Client-only extra field: `commentsRevision`.

No type mismatch found. Shared props read: `locale` (RowMeta index.tsx:210, comments, due-date chip, recurrence badge, link chips); partial reloads also refresh shared `actionItems` and `notifications` (index.tsx:85).

### 3. Layout

`AppLayout` (default, js/app.tsx:70).

### 4. User actions

All mutations below are **JSON, not Inertia**, sent through `retroRequest` (js/lib/retro/api.ts:38): Inertia's `http` client, `Accept: application/json`, `X-Socket-ID` header when Echo is configured (so the server's `sendToOthers()` skips the sender), 15 s `AbortSignal.timeout` (45 s for exports). Errors become `RetroRequestError(status, message, errors)` where message = first validation error, else `message`, and status `0` = timeout.

Every mutation goes through the page's `run` wrapper (`useToastRun`, index.tsx:174): on failure it shows `toast.error` (timeout text / server message / generic text), then `router.reload({only: ['items','focusedItem','actionItems','notifications']})`, and resolves `undefined`.

Endpoint set = `workspaceActionItemEndpoints(workspace.slug)` (js/lib/action-items/endpoints.ts:90). All server handlers first call `WorkspaceActionItemGuard::visible` (404, never 403, when the item is in another workspace or a team the viewer cannot see) and `lockWritable` (item of a non-completed retro whose board is locked is frozen: `RetroGuard::unlocked`, app/Actions/ActionItems/WorkspaceActionItemGuard.php:27).

"Manages" = `canManageActionItem` (js/lib/action-items/permissions.ts:19): author (`item.isMine`) or workspace manager or facilitator of the item's retro. "Completes" = manages, or assignee, or `viewer.reviewTeamIds` includes `item.teamId` (permissions.ts:48). On this page `editable` is always `true` and `participantId` is `null`.

| Action | UI element | Request | Who |
|---|---|---|---|
| Filter by status | `Select` aria "Status" (index.tsx:583) | `router.get` `GET w/{workspace}/action-items?...` with `preserveState, preserveScroll`; query omits `status=open` and null filters and always drops `item`; also written to `localStorage` | any workspace member |
| Filter by assignee | `Select` aria "Assignee": Anyone / Me / Unassigned / each `assignees[]` (index.tsx:605) | same | any |
| Filter by team | `Select` aria "Team": All teams / each `teams[]` (index.tsx:635) | same | any |
| Persist filters | `localStorage` key `skrum.actionItemFilters.{workspace.id}` = JSON of the query object (index.tsx:95-148) | client-only | any |
| Restore filters | on mount, when `window.location.search === ''` and stored query is non-empty: `router.get(..., {preserveState: true, replace: true})` (index.tsx:466-484) | GET index | any |
| Pagination | "Previous"/"Next" `Link preserveScroll` + "Page :page of :total" (index.tsx:680-706), shown when `lastPage > 1` | GET `prevPageUrl`/`nextPageUrl` | any |
| Open "New action item" dialog | Button (index.tsx:574), only if `creatableTeams.length > 0` | client-only | team members |
| Pick team in dialog | `Select` aria "Team" (index.tsx:288); default = `filters.team` if creatable, else first creatable team; `ActionItemForm` is re-keyed (reset) on team change | client-only | |
| Create action item | `ActionItemForm` (js/components/action-items/action-item-form.tsx:61): content input (max 500, required), `PrioritySelect` (default `medium`), date input (min 2000-01-01, max 2100-12-31; clearing it resets recurrence), `RecurrenceSelect` (disabled without due date), `AssigneeSelect` (team members of the chosen team), submit "Create" | `POST w/{workspace}/action-items` `workspaces.actionItems.store` `WorkspaceActionItemsController@store` (:85). Body `{team_id, content, priority, due_on, recurrence, assignee_user_id, assignee_participant_id: null}`. 201 `{actionItem}`. Then full partial reload + dialog closes | must be a **member of the team** (`ActionItemPermissions::authorizeCreateWithoutRetro`, 403 "Only team members can add action items to this team."); `team_id` must be in the workspace and viewable |
| Complete / reopen | Checkbox aria "Mark as done"/"Reopen" (action-item-card.tsx:177) | `PATCH w/{workspace}/action-items/{actionItem}` `workspaces.actionItems.update` `@update` (:111), body `{status: 'completed'|'open'}` -> `{actionItem}` | completes (server: `authorizeComplete`). Completing a recurring item creates the next occurrence server-side (`SetActionItemStatus` -> `CreateNextOccurrence`) |
| Edit content | Pencil button aria "Edit action item" -> inline input (max 500) + "Save"; Enter submits, Escape cancels; empty or unchanged = no request (card:145-155, 189-216, 281-294) | PATCH same, `{content}` | manages |
| Change priority | `PrioritySelect` High/Medium/Low with icons (card:318) | PATCH `{priority}` | manages |
| Change due date | date input aria "Due date", saved **on blur** only when changed and not a partial/bad input; reverts the draft on failure (card:157-169, 323-338) | PATCH `{due_on: 'Y-m-d' \| null}` | manages |
| Change recurrence | `RecurrenceSelect` Does not repeat / Weekly / Every 2 weeks / Monthly; disabled when `item.dueOn === null` (card:340) | PATCH `{recurrence}`; server 422 "A recurring action item needs a due date." | manages |
| Change assignee | `AssigneeSelect` (card:345): "Unassigned", grouped "Team" options from `teams[item.teamId].members`; if the current assignee is not in the list (guest, or "(not in team)") it is shown as a disabled option | PATCH `{assignee_user_id, assignee_participant_id}` (`assigneePayload`, js/lib/action-items/assignees.ts:17). Workspace endpoints **prohibit** a non-empty `assignee_participant_id` ("Guests can only be assigned from their own retrospective."); user must be a team member unless unchanged | manages |
| Delete action item | Trash button aria "Delete action item" (card:295); **no confirmation** | `DELETE w/{workspace}/action-items/{actionItem}` `workspaces.actionItems.destroy` `@destroy` (:125) -> 204 | manages |
| Add sub-task | input (max 200) + "Add" (subtask-checklist.tsx:224-248); hidden at 20 sub-tasks (`MaxSubtasks`) | `POST w/{workspace}/action-items/{actionItem}/subtasks` `workspaces.actionItemSubtasks.store` -> 201 `{actionItem}` | manages |
| Tick / untick sub-task | Checkbox aria = sub-task text (subtask-checklist.tsx:106) | `PATCH w/{workspace}/action-item-subtasks/{actionItemSubtask}` `workspaces.actionItemSubtasks.update`, `{status}` -> `{actionItem}` | completes |
| Rename sub-task | Pencil aria "Edit sub-task" -> inline input (max 200), Enter saves, Escape cancels (subtask-checklist.tsx:117-147, 189-202) | PATCH same, `{content}` | manages |
| Move sub-task up / down | Arrow buttons aria "Move up"/"Move down", disabled at the ends (subtask-checklist.tsx:157-188). Keyboard-accessible reorder, no drag-and-drop | PATCH same, `{position: index ± 1}` (0..19) | manages |
| Delete sub-task | Trash aria "Delete sub-task" (subtask-checklist.tsx:203) | `DELETE w/{workspace}/action-item-subtasks/{actionItemSubtask}` `workspaces.actionItemSubtasks.destroy` -> `{actionItem}` | manages |
| Toggle comments | Button "1 comment"/":count comments", `aria-expanded`, `aria-controls` (card:352-365); starts expanded when `item.id === filters.item` | opens thread -> `GET w/{workspace}/action-items/{actionItem}/comments` `workspaces.actionItemComments.index` -> `{comments}` (oldest first) | any viewer of the team |
| Retry loading comments | "Retry" button after "Could not load the comments." (action-item-comments.tsx:181-197) | GET same | |
| Add comment | Textarea (max 500) + "Comment" (action-item-comments.tsx:295-321) | `POST .../action-items/{actionItem}/comments` `workspaces.actionItemComments.store`, `{content}` -> 201 `{comment}`; local list appended, count pushed up via `onCommentCount` | anyone who can view the team (`canComment`) |
| Edit comment | Pencil aria "Edit comment" -> Textarea + Save / Cancel (action-item-comments.tsx:215-230, 249-286) | `PATCH w/{workspace}/action-item-comments/{actionItemComment}` `workspaces.actionItemComments.update` -> `{comment}` | comment author only (`comment.isMine`) |
| Delete comment | Trash aria "Delete comment", no confirmation (action-item-comments.tsx:231-247) | `DELETE w/{workspace}/action-item-comments/{actionItemComment}` `workspaces.actionItemComments.destroy` -> 204 | author, or whoever manages the item |
| Export to tracker (open) | Upload icon button: one tracker -> direct button aria "Export to :provider"; several -> dropdown menu aria "Export" with one entry per tracker (export-action-item-button.tsx:57-95). Trackers the item already has an `externalLinks` entry for are removed (one export per provider) | client-only | manages AND `viewer.userId !== null` AND `exportSources[item.teamId]` non-empty (card:272) |
| Export dialog: load targets | on open and on each project change / search (export-action-item-dialog.tsx:183-274) | `GET w/{workspace}/teams/{team}/integrations/{integration}/targets?project_id=&q=` `teams.integrations.targets.index` `IntegrationTargetsController@index` (throttle 30/min; `Gate view team`) -> `ExportTargets {projects?, issueTypes?, teams?, repositories?, defaults}` | |
| Export dialog: search | Input "Search projects" (Jira / Jira DC) or "Search repositories" (GitHub), max 100, **debounced 300 ms** (`SearchDelayMs`) with spinner; "No project found." / "No repository found." | same GET with `q` | |
| Export dialog: choose target | Jira: "Project" select (changing it refetches issue types) + "Issue type" select; GitHub: "Repository" select; Linear: "Linear team" select. A selected project/repository that is no longer in the listed results stays in the options | client-only / GET | |
| Export dialog: preview lines | assignee line (mapped / will match by email or GitHub sign-in / guest / never assigned / unassigned) and priority line (export-action-item-dialog.tsx:65-94, 492-513); refetched when `item.assignee.id` or `item.priority` changes | `GET w/{workspace}/action-items/{actionItem}/exports/preview?source=` `workspaces.actionItemExports.preview` `WorkspaceActionItemExportPreviewsController@show` -> `{assignee: {state, displayName}, priority: {name}}`; failures are swallowed (preview hidden) | |
| Export dialog: "Manage people" link | Inertia `Link` to `teams.integrations.index` (export-action-item-dialog.tsx:514-524) | GET `w/{workspace}/teams/{team}/integrations` | only when `viewer.isWorkspaceManager` (`canManagePeople`) |
| Export dialog: submit | "Export" button (spinner while busy), "Cancel" | `POST w/{workspace}/action-items/{actionItem}/exports` `workspaces.actionItemExports.store` `WorkspaceActionItemExportsController@store`; body `{source, project_id, issue_type_id}` (jira, jira_dc) / `{source, repository_id}` (github) / `{source, team_id}` (linear); 45 s timeout -> 201 `{actionItem, warnings: [{code, message}]}`. Success: `toast.success('Exported as :key.')`, one `toast.warning` per warning with a message, card updated, dialog closed | manages, authenticated user (guests refused server-side) |
| Open tracker issue | link chip `<a target="_blank" rel="noreferrer">` with issue key, status dot, tooltip ":status in :source · synced :time" computed when the tooltip opens (external-link-chips.tsx:96-136) | external URL | members (links are `[]` for guests, `null` in broadcasts) |
| Retry tracker sync | Refresh icon aria "Retry the sync of :key", only when `link.syncState === 'failed'` (external-link-chips.tsx:137-148) | `POST w/{workspace}/action-items/{actionItem}/external-links/{externalLink}/sync` `workspaces.actionItemLinkSyncs.store` (throttle 10/min) -> 202 `{actionItem}`; `toast.success('Sync requested.')`. 409 when status sync is off or the issue belongs to another site | manages |
| Open source retro | `Link` to `item.source.retroUrl` showing title and date; "Added outside a retro" when no retro (index.tsx:219-230) | GET `retros.show` | any |

Optimistic behaviour: none is truly optimistic; each card waits for the response then calls `onSaved` (replace row + schedule a reload after 1 s, coalesced: `ReloadDelayMs`, index.tsx:359-368) or `onRemoved` (filter row out + schedule reload). The delayed reload re-sorts / re-filters the list and refreshes the sidebar overdue badge and the notification count. Each card and each checklist has a `busy` flag that blocks concurrent requests.

Other refresh triggers: `window` `focus` event -> immediate partial reload (index.tsx:454-464).

### 5. Realtime

Done inline in the page (index.tsx:405-452) with `echo()` from `@laravel/echo-react`, no dedicated hook.

- Channels: one **private** channel per id in `realtimeTeamIds`: `team-action-items.{teamId}` (wire name `private-team-action-items.{teamId}`). Auth: `BroadcastAuthorizationsController@authorizeTeamActionItemsChannel` (app/Http/Controllers/BroadcastAuthorizationsController.php:267): authenticated user who `can('view', $team)`; a guest cookie never grants it.
- Effect is keyed on `realtimeTeamIds.join(',')`; cleanup calls `echo().leave(name)` for each channel.
- This page is the **only** front subscriber of that channel (grep of `js/` confirms).

| Event string | Class | Payload | Client reaction |
|---|---|---|---|
| `.team-action-item.saved` | `App\Events\ActionItems\TeamActionItemSaved` | `{actionItem}` presented **without a viewer**: `isMine: false`, `externalLinks: null`, `completedVia: null` | `replaceActionItem` (index.tsx:150): replaces the row but keeps local `isMine` (OR), `commentsRevision`, `externalLinks` when incoming is null, and `completedVia` when still completed; then schedules the 1 s reload. A saved item that is not on the current page is not inserted until the reload |
| `.team-action-item.deleted` | `TeamActionItemDeleted` | `{actionItemId}` | schedule reload only (payload unused) |
| `.team-action-item.comments.changed` | `TeamActionItemCommentsChanged` | `{actionItemId, commentCount}` | `countActionItemComments(..., refresh: true)` (js/lib/retro/board-reducer.ts:348): sets the count and bumps `commentsRevision`, which makes an open comment thread refetch |

All three extend `TeamActionItemsBroadcastEvent` (`ShouldBroadcastNow`, after commit) and are fired with `sendToOthers()` from `BroadcastActionItemChange` (app/Actions/ActionItems/BroadcastActionItemChange.php:42,58,73).

Not broadcast on this channel: external-link changes. `BroadcastActionItemChange::externalLinksChanged` (:80) only targets retro member channels, so tracker status sync results reach this page only through a reload (focus, or the next save).

Non-broadcast domain events in `app/Events/ActionItems`: `ActionItemCreated`, `ActionItemAssigned`, `ActionItemCompleted`, `ActionItemReopened` are plain dispatchables consumed by listeners (webhook queueing, tracker status pushes); the front never sees them.

No presence, no whispers. Reconnect: no explicit resync; the window-focus reload is the only catch-up. Connection state: `useSafeConnectionStatus()` (js/hooks/use-retro-channel.ts:112) + `subscribedChannels` feed a `data-realtime="connecting|connected"` attribute on the root div (`realtimeState`, js/lib/realtime/realtime-state.ts), "connected" only when the socket is up and every channel has confirmed subscription. This attribute is a hook for the browser test suite.

### 6. Role / permission-conditional UI

| UI | Driver | Server check |
|---|---|---|
| "New action item" button | `creatableTeams.length > 0` | team membership (`authorizeCreateWithoutRetro`) |
| Edit / delete / priority / due date / recurrence / assignee / sub-task management / export / sync retry | `canManageActionItem`: `item.isMine` or `viewer.isWorkspaceManager` or `viewer.facilitatedRetroIds.includes(item.retroId)` | `ActionItemPermissions::isManager` (author, retro facilitator, workspace manager) |
| Complete checkbox, sub-task checkboxes | `canCompleteActionItem`: manages, or assignee is `viewer.userId`, or `viewer.reviewTeamIds.includes(item.teamId)` | `ActionItemPermissions::canComplete` |
| Edit comment | `comment.isMine` | `canEditComment` (author only) |
| Delete comment | `comment.isMine` or manages | `canDeleteComment` |
| Export button | manages + `exportSources[teamId]` non-empty + provider not already linked | `ActionItemExportGuard::authorize` + integration connected and writable |
| "Manage people" link in export dialog | `viewer.isWorkspaceManager` | `TeamPolicy::manageIntegrations` |
| Team / assignee filter options, list contents | visible teams | `ActionItemQuery::visibleTo` |
| Controls on an item of a locked running retro | not reflected in the UI; the server rejects via `RetroGuard::unlocked` and the toast shows the message | `WorkspaceActionItemGuard::writable` |

Disabled (not hidden) when not allowed: checkbox, priority, date, recurrence and assignee selects. Hidden when not allowed: pencil, trash, export, sub-task controls, the whole sub-task block when empty and not manageable.

### 7. Other state worth preserving

- Server ordering (`ActionItemQuery::order`): open before completed; overdue first; due date ascending, none last; priority high > medium > low; completed by completion date desc; newest first. The page does not re-sort locally; it relies on the delayed reload (`compareActionItems` in js/lib/action-items/order.ts mirrors this order but is only used by the retro board reducer).
- Focused item: when `?item=` is set, the card gets `defaultExpanded` (comments open) and the page scrolls `#action-item-{id}` into view (`block: 'center'`, index.tsx:486-494). If the item is not in the current filtered page, it is rendered alone above the list under a "Linked action item" heading (index.tsx:660-668). Changing a filter drops `item`.
- Derived-state resets: `rows` and `focused` are reset whenever the `items.data` / `focusedItem` prop identity changes (index.tsx:349-357); the card resets its due-date draft when `item.dueOn` changes.
- Empty states: "No open action items." (default filters) vs "Nothing matches these filters."
- Card meta row: priority icon, `DueDateChip` ("Overdue · date" destructive badge or "Due :date"; dates formatted in UTC to keep the picked day), `RecurrenceBadge` ("Repeats weekly…", plus "Follows up the item completed on :date" when `previousOccurrenceId`), sub-task progress `done/total` with aria label, creator avatar + name ("Former member" fallback), "Theme: :name" badge, link chips, "Completed in :source" when completed by tracker sync, then page meta: team badge, source retro link, assignee label (":name (guest)", ":name (not in team)").
- Comment thread states: "Loading…", load error + Retry, "No comments yet.", author fallback "Former member", `<time>` element. The thread refetches whenever `item.id`, `commentsRevision` or the retry counter changes.
- `AnonymousNotice` ("Action items are not anonymous: your name is shown.") exists in the form and the comment box but is **never shown on this page** (`showAnonymousNotice` is not passed); it is used on the retro board.
- Toast messages: timeout text, server message, generic fallback, "Sync requested.", "Exported as :key.", export warnings.
- A11y: aria-labels on every icon button and select, `nav aria-label="Pagination"`, `ul aria-label="Sub-tasks"`, `sr-only` sync description inside link chips, `aria-expanded`/`aria-controls` on the comments toggle.

---

## pages/workspaces/show.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}` | `workspaces.show` | GET | `WorkspacesController@show` (`Inertia::render` at app/Http/Controllers/WorkspacesController.php:35) | common group |
| `dashboard` | `dashboard` | GET | `CurrentWorkspaceController@show` (app/Http/Controllers/CurrentWorkspaceController.php:10) | `auth`, `verified` |

`/dashboard` renders nothing: it is a pure redirect. It picks the user's workspace matching `users.current_workspace_id` (only if still a member), else the first workspace by name; none -> redirect to `workspaces.create`; otherwise redirect to `workspaces.show`. It is the post-login landing (`redirect()->intended(route('dashboard'))`), the logo link, the header link, the fallback of the "Teams" sidebar item when `currentWorkspace` is null, and the destination after leaving / deleting a workspace or deleting a retro / poker game / game room without a team link.

### 2. Props

| Prop | Shape | Built | TS |
|---|---|---|---|
| `workspace` | `{id, name, slug}` | controller:36 | `WorkspaceSummary` |
| `teams` | `Array<{id, name}>` | controller:37 (`teamsVisibleTo`, ordered by name) | `TeamSummary[]` |
| `canManage` | bool | controller:38 (`User::canManage`) | matches |

Shared props read: `auth.user.id` (show.tsx:20, for the leave form).

### 3. Layout

`AppLayout` (default).

### 4. User actions

| Action | UI element | Request | Who |
|---|---|---|---|
| Create team | Inertia `<Form resetOnSuccess>` with input `name` (required, max 100, placeholder "New team name") + "Create team" (show.tsx:31-55); inline `errors.name` | `POST w/{workspace}/teams` `teams.store` `TeamsController@store` | `canManage` (managers) |
| Open a team | Card `Link` per team (show.tsx:66-80) | GET `w/{workspace}/teams/{team}` `teams.show` | any (list already filtered) |
| Leave workspace | `<Form>` ghost button "Leave workspace", **no confirmation dialog** (show.tsx:83-101); shows `errors.member` | `DELETE w/{workspace}/members/{auth.user.id}` `workspaces.members.destroy` `WorkspaceMembersController@destroy` (:74). Self-removal skips the `manageMembers` gate; detaches the user from all workspace teams and the workspace, clears `current_workspace_id`, redirects to `dashboard`. 422 `member` = "A workspace needs at least one owner." for the last owner | any member |

### 5. Realtime

None.

### 6. Role-conditional UI

- Create-team form: `canManage`.
- Empty text: "No teams yet. Create the first one." (manager) vs "You are not a member of any team yet." (member).
- Server: `TeamPolicy::create` for team creation.

### 7. Other state

- Visiting any workspace URL makes it the current workspace (middleware), which is what drives the `currentWorkspace` shared prop, the sidebar and `/dashboard`.
- Workspace switching UI lives in `js/components/workspace-switcher.tsx` (links to `workspaces.show` for each `workspaces[]` entry and to `workspaces.create`); owned by the layout slice but depends on these routes.

---

## pages/workspaces/create.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `workspaces/create` | `workspaces.create` | GET | `WorkspacesController@create` (`Inertia::render` at WorkspacesController.php:17) | `auth`, `verified` (not in the `w/{workspace}` group) |

### 2. Props

None passed; the page declares none.

### 3. Layout

`AppLayout` (default). The user may have no workspace at all here (`currentWorkspace` null).

### 4. User actions

| Action | UI element | Request | Who |
|---|---|---|---|
| Create workspace | Inertia `<Form>`: label "Workspace name", input `name` (required, autoFocus, max 100), `errors.name`, button "Create workspace" (create.tsx:23-47) | `POST workspaces` `workspaces.store` `WorkspacesController@store` (:20). `CreateWorkspace` generates slug `{slug(name) or 'workspace'}-{6 random chars}`, attaches the creator as `owner`, sets it current, redirects to `workspaces.show` | any verified user |

### 5-7

No realtime, no role gating, no other state. Reached from `/dashboard` when the user has no workspace, and from the workspace switcher.

---

## pages/workspaces/members.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/members` | `workspaces.members.index` | GET | `WorkspaceMembersController@index` (`Inertia::render` at app/Http/Controllers/WorkspaceMembersController.php:25) | common group + `Gate::authorize('manageMembers')` -> **403 for plain members** |

### 2. Props

| Prop | Shape | Built | TS |
|---|---|---|---|
| `workspace` | `{id, name, slug}` | :26 | ok |
| `members` | `Array<{id, name, email, role}>` ordered by name | :27-30 | `WorkspaceMember[]` |
| `invitations` | `Array<{id, email, role, isExpired}>`, non-accepted only, newest first | :31-37 (`isExpired = !isPending()`) | `PendingInvitation[]` |
| `canManage` | always `true` | :38 | **Mismatch: sent by the controller, absent from TS `Props`, never read** |
| `isOwner` | bool | :39 | ok |

Shared: `auth.user.id` (members.tsx:48). Flash: `page.flash.invitationUrl` (members.tsx:49; typed in js/types/global.d.ts:30).

### 3. Layout

`AppLayout` (default). Sidebar "Members" entry only when `currentWorkspace.role !== 'member'` (app-sidebar.tsx:53).

### 4. User actions

| Action | UI element | Request | Who |
|---|---|---|---|
| Change a member's role | `Select` aria "Role" per row (members.tsx:86-137); options `owner, admin, member` for an owner, `admin, member` for an admin. Fires immediately on change, no confirmation | `router.patch` `PATCH w/{workspace}/members/{member}` `workspaces.members.update` `@update` (:43), `{role}`, `preserveScroll`. `onError` stores `errors.role` under that row (`InputError`), `onSuccess` clears it | managers. Server: only an owner can grant `owner` or change an owner (403); demoting the last owner -> 422 `role` "A workspace needs at least one owner." A member can change their **own** role too (the select is shown for self) |
| Remove member / leave | `ConfirmFormDialog` trigger "Remove" (or "Leave" for self) (members.tsx:148-196); dialog title "Remove :name from this workspace?" / "Leave this workspace?", description, destructive confirm, `errorKey="member"` | `DELETE w/{workspace}/members/{member}` `workspaces.members.destroy` `@destroy` (:74), `preserveScroll`. Removing someone else -> `back()`; leaving -> redirect `dashboard` | managers; owners can only be removed by owners; last owner cannot be removed (422 `member`) |
| Invite | Inertia `<Form resetOnSuccess={['email']}>`: email input (required), `Select name="role"` default `member` (Member / Admin; **owner cannot be invited**), "Send invitation" (members.tsx:205-246); `errors.email` | `POST w/{workspace}/invitations` `workspaces.invitations.store` `WorkspaceInvitationsController@store` (:22), throttle 20/min. 422 `email` "This person is already a member of the workspace." Re-inviting the same email replaces the previous pending invitation. Token = 40 random chars stored hashed, valid 7 days. Sends `WorkspaceInvitationNotification` in the recipient's locale if they already have an account | managers |
| Copy invitation link | read-only `Input` with select-on-focus, shown only when the flash `invitationUrl` is present, i.e. when `config('mail.default') === 'log'` (members.tsx:248-263); text "Email is not configured on this instance. Share this link with the invited person:" | client-only (no clipboard API; the user copies manually) | managers |
| Revoke invitation | `<Form>` ghost button "Revoke" per pending invitation, no confirmation (members.tsx:282-300) | `DELETE w/{workspace}/invitations/{invitation}` `workspaces.invitations.destroy` `@destroy` (:59), `preserveScroll` | managers |
| Delete workspace | section "Delete workspace" with `ConfirmFormDialog` (title "Delete this workspace?", destructive "Delete workspace") (members.tsx:306-331) | `DELETE w/{workspace}` `workspaces.destroy` `WorkspacesController@destroy` (:42), `Gate::authorize('delete')` -> redirect `dashboard` | `isOwner` only |

### 5. Realtime

None.

### 6. Role-conditional UI

- Whole page: managers only (server 403).
- Row of an owner seen by a non-owner: a static "Owner" badge instead of the role select, and no Remove button (`member.role === 'owner' && !isOwner`, members.tsx:82, 148).
- Assignable roles: `isOwner` adds `owner`.
- Delete-workspace section: `isOwner`.
- Self row: wording switches to Leave.

### 7. Other state

- Pending invitations show a role badge and a destructive "Expired" badge when `isExpired`.
- The invitation list `<ul>` renders even when empty (empty bordered box).
- `components/confirm-form-dialog.tsx` (shared: also used by templates and `settings/revoke-token-dialog`): uncontrolled `Dialog` with `DialogTrigger`, Inertia `<Form {...form}>` taking `action`/`method`/`options`, optional `errorKey` to print one validation error, "Cancel" (`DialogClose`) and a destructive submit disabled while processing. It does **not** close itself on success; it disappears because the row/page is re-rendered or redirected.
- A 403 on the role PATCH (admin touching an owner) is not handled by `onError` (it is not a validation error); behaviour then is Inertia's default HTTP-exception handling.

---

## pages/workspaces/templates.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/templates` | `workspaces.templates.index` | GET | `WorkspaceTemplatesController@index` (`Inertia::render` at app/Http/Controllers/WorkspaceTemplatesController.php:24) | common group (any member can view) |

### 2. Props

| Prop | Shape | Built | TS |
|---|---|---|---|
| `workspace` | `{id, name, slug}` | :25 | ok |
| `templates` | `Array<{id, name, category, columns: Array<{title, description: ?string, color}>}>` ordered by name | :26-28, `present()` :101 | `WorkspaceTemplateSummary[]` |
| `categories` | `Array<{value, label}>` (labels already translated server-side) | `TemplateCategory::options()` | `CategoryOption[]`; values `essentials, team_mood, themed, ideas, analysis` |
| `canManage` | bool | :30 | ok |
| `catalogue` | `Inertia::optional`: `Array<{key, name, category: ?string, isCommon, isWorkspace, columns}>` = workspace templates then built-ins (`BuildTemplateCatalogue::handle`, app/Actions/Retros/BuildTemplateCatalogue.php) | :31 | `catalogue?: CatalogueTemplate[]`; absent on first load |

No mismatch.

### 3. Layout

`AppLayout` (default). Sidebar "Templates" entry for every role.

### 4. User actions

| Action | UI element | Request | Who |
|---|---|---|---|
| Open "New template" editor | Button (templates.tsx:90-95) | on mount of the editor in create mode, if `catalogue` is undefined: `router.reload({only: ['catalogue']})` (templates.tsx:203-207). No skeleton: the "start from" select simply appears once loaded | `canManage` |
| Start from a built-in template | `Select` "Start from a built-in template" (create mode only, built-ins with at least one column, i.e. `!isWorkspace`) (templates.tsx:292-317): fills category and columns, and the name only if still empty | client-only | |
| Edit name | Input (required, max 80) | client | |
| Edit category | `Select` over `categories` (default `essentials`) | client | |
| Edit a column | title Input (required, max 100), color `Select` (green, red, blue, amber, purple, slate), description Textarea (max 200, optional) | client | |
| Reorder columns | "Move up"/"Move down" icon buttons, disabled at the ends (templates.tsx:411-433). Button-based, no drag-and-drop | client | |
| Remove column | Trash button aria "Remove column", disabled when only one column | client | |
| Add column | "Add column" button, disabled at 10 (`MaxColumns`); new column color cycles through `ColumnColors` by index | client | |
| Save (create) | `useForm.submit` | `POST w/{workspace}/templates` `workspaces.templates.store` `@store` (:35), body `{name, category, columns: [{title, description, color}]}`, `preserveScroll`, closes on success; flash toast "Template saved." | managers (`WorkspaceTemplateRequest::authorize` -> `manageTemplates`). 422: duplicate name (case-insensitive) "A template with this name already exists."; workspace cap of 100 -> `name` "This workspace already has 100 templates." |
| Open "Edit" editor | "Edit" button per row (templates.tsx:119-127); editor is keyed by template id | client | `canManage` |
| Save (update) | same form | `PATCH w/{workspace}/templates/{template}` `workspaces.templates.update` `@update` (:57); columns are fully replaced; toast "Template saved." | managers |
| Delete template | `ConfirmFormDialog` "Delete this template?" / "Retrospectives created from it keep their columns." (templates.tsx:128-151) | `DELETE w/{workspace}/templates/{template}` `workspaces.templates.destroy` `@destroy` (:70); toast "Template deleted." | managers |
| Cancel editor | "Cancel" button or dialog dismissal | client | |

Errors shown: `errors.name`, `errors.category`, per column the first of `columns.{i}.title | .description | .color`, and `errors.columns`.

### 5. Realtime

None.

### 6. Role-conditional UI

`canManage` gates "New template", "Edit" and "Delete". Members see a read-only list (name, category badge, column chips).

### 7. Other state

- Empty state: "No workspace templates yet."
- `TemplateChips` (js/components/templates/template-chips.tsx): compact pill list here (color swatch + truncated title); it also has a `withDescriptions` list variant used by `js/components/teams/new-retro-dialog.tsx`.
- Flash toasts are displayed by `useFlashToast` (js/hooks/use-flash-toast.ts) mounted in the global Toaster.
- Editor dialog has `aria-describedby={undefined}` and scrolls (`max-h-[90dvh]`).

### Whiteboard templates: NOT on this page

The task description assumed whiteboard-template rename/delete live on the templates page. They do not. This page handles retro templates only and receives no whiteboard data.

Whiteboard templates are managed from the **team page** (`pages/teams/show.tsx` -> `js/components/teams/whiteboards-section.tsx:84` -> `js/components/teams/whiteboard-templates-dialog.tsx`), using the two routes of this slice's backend:

| Action | UI element | Request | Who |
|---|---|---|---|
| Open manager | "Whiteboard templates" outline button -> Dialog (whiteboard-templates-dialog.tsx:30-43) | client-only | any team viewer |
| Rename / edit description | "Edit" -> inline form: Name (required, max 80), Description (max 300), Save / Cancel (whiteboard-templates-dialog.tsx:161-234) | `router.patch` `PATCH w/{workspace}/whiteboard-templates/{whiteboardTemplate}` `workspaces.whiteboardTemplates.update` `WorkspaceWhiteboardTemplatesController@update` (:15), `{name, description}`, `preserveScroll`; validation errors inline; on HTTP exception: reload `['whiteboardTemplates','whiteboardGallery']`, close the form, and suppress the default error modal (`return false`) | `template.canManage` = workspace manager or creator (`WhiteboardTemplatePolicy`, app/Policies/WhiteboardTemplatePolicy.php:21). Name uniqueness enforced under a workspace lock (`WhiteboardTemplateRules::ensureNameIsFree`) |
| Delete | "Delete" -> inline confirmation strip "Delete this template? Boards already created from it are not changed." with Delete / Cancel (whiteboard-templates-dialog.tsx:117-152) | `router.delete` `DELETE w/{workspace}/whiteboard-templates/{whiteboardTemplate}` `workspaces.whiteboardTemplates.destroy` `@destroy` (:37); same HTTP-exception handling | same |

Props come from `TeamsController@show` (`whiteboardTemplates`: `{id, name, description, canManage}`, app/Http/Controllers/TeamsController.php:112-120; `whiteboardGallery` optional). Empty state: "No whiteboard templates yet." + "Save a board as a template from its menu." Creation of a whiteboard template happens from inside a whiteboard (another slice).

`js/components/teams/whiteboard-template-preview.tsx` is an SVG thumbnail (`rect`, `ellipse`, `diamond` polygon, `path` polyline, grey bar for `text`; stroke width = max(width, height) / 200; `aria-hidden`). It is used only by `js/components/teams/new-whiteboard-dialog.tsx:96` (the gallery when creating a board), not by the manager dialog and not by the templates page.

---

## pages/invitations/show.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `invitations/{token}` | `invitations.show` | GET | `InvitationLinksController@show` (`Inertia::render` at app/Http/Controllers/InvitationLinksController.php:19 for the invalid state, :36 otherwise) | none (public; routes/web.php:170) |
| `invitations/{token}/acceptance` | `invitations.acceptance.store` | POST | `InvitationAcceptancesController@store` (app/Http/Controllers/InvitationAcceptancesController.php:12) | `auth` (web.php:183) |

### 2. Props

Invalid token (no row matching the SHA-256 of the token): `{isInvalid: true}` only, rendered with **HTTP 404**.

Otherwise:

| Prop | Shape | Built |
|---|---|---|
| `token` | string (raw token from the URL) | :37 |
| `isInvalid` | `false` | :38 |
| `workspaceName` | string | :39 |
| `email` | invited email | :40 |
| `isExpired` | `!isPending()` (expired **or already accepted**) | :41 |
| `isLoggedIn` | bool | :42 |
| `emailMatches` | logged in and case-insensitive email match | :43 |
| `canRegister` | `SignupGate::canShowRegistration($invitation)` (app/Actions/Auth/SignupGate.php:27) | :44 |

TS `Props` (show.tsx:8-17) marks everything except `isInvalid` optional with defaults; consistent.

Before rendering: a logged-in user who already belongs to the workspace is **redirected to `workspaces.show`** (:26). Otherwise the controller stores `invitation_token` in the session (:30) and, for a logged-out visitor, sets the intended URL to this invitation URL (:33).

### 3. Layout

`AuthLayout` (js/app.tsx:65). No sidebar.

### 4. User actions

| State | UI | Request |
|---|---|---|
| Invalid token | heading "Invitation" + destructive text "This invitation link is no longer valid." (show.tsx:31-43) | none |
| Expired / used | heading "Join :workspace", "This invitation was sent to :email.", destructive "This invitation has expired or was already used." No buttons | none |
| Logged in, email matches | `<Form>` button "Accept invitation" (show.tsx:62-72) | `POST invitations/{token}/acceptance`: 404 unknown token, 410 not pending, 403 email mismatch; marks the email verified if it was not; attaches the user with the invited role, sets `accepted_at`, sets the workspace current, forgets `invitation_token`, redirects to `workspaces.show` |
| Logged in, other email | destructive text "You are logged in with another email address. Log out and sign in as :email to accept." + `<Form {...logout.form()}>` outline button "Log out" (show.tsx:74-91) | Fortify `POST logout` (`logout` from `@/routes`) |
| Logged out | "Log in" button (`Link` to `login()`), and "Create an account" (`Link` to `register()`) only when `canRegister` (show.tsx:93-106) | GET Fortify login / register |

### 5. Realtime

None.

### 6. Conditional UI

Driven entirely by `isInvalid`, `isExpired`, `isLoggedIn`, `emailMatches`, `canRegister`.

`canRegister`: true for the very first user, or when the invitation is pending, or when the signup mode is not `Invite`. Since buttons only show when not expired, a pending invitation always allows registration here.

### 7. Session `invitation_token` flow (must survive the rewrite)

- **Login**: the intended URL was set to the invitation URL, so after Fortify login the user returns to this page and sees the Accept button (or the wrong-email state). Acceptance is an explicit click.
- **Register**: the Fortify register view reads the session token (app/Providers/FortifyServiceProvider.php:74-85, 92-95): it 403s if registration is not allowed, and passes `invitationEmail` to `auth/register` when the invitation is pending; the register page pre-fills the email and makes it read-only (js/pages/auth/register.tsx:69-70). `CreateNewUser` (app/Actions/Fortify/CreateNewUser.php:31-58) bypasses signup restrictions for a pending invitation whose email matches, and when it matches it marks the email verified, **accepts the invitation automatically**, and forgets `invitation_token` and `url.intended` (so the new user lands on `/dashboard` -> the joined workspace, never back on this page).
- **SSO**: `SsoCallbacksController` (app/Http/Controllers/SsoCallbacksController.php:35-45) passes the session invitation to `ResolveSsoUser` and forgets `invitation_token` + `url.intended` once the invitation is accepted.
- The token in the session is the raw token; lookups always hash it (`WorkspaceInvitation::findByToken`).

---

## Slice notes

### JSON (non-Inertia) endpoints called by the front in this slice

All via `retroRequest` (`Accept: application/json`, `X-Socket-ID`):

- `POST w/{workspace}/action-items` -> 201 `{actionItem}`
- `PATCH w/{workspace}/action-items/{actionItem}` -> `{actionItem}`
- `DELETE w/{workspace}/action-items/{actionItem}` -> 204
- `GET | POST w/{workspace}/action-items/{actionItem}/comments` -> `{comments}` / 201 `{comment}`
- `PATCH | DELETE w/{workspace}/action-item-comments/{actionItemComment}` -> `{comment}` / 204
- `POST w/{workspace}/action-items/{actionItem}/subtasks` -> 201 `{actionItem}`
- `PATCH | DELETE w/{workspace}/action-item-subtasks/{actionItemSubtask}` -> `{actionItem}`
- `GET w/{workspace}/action-items/{actionItem}/exports/preview?source=` -> `{assignee, priority}`
- `POST w/{workspace}/action-items/{actionItem}/exports` -> 201 `{actionItem, warnings}`
- `POST w/{workspace}/action-items/{actionItem}/external-links/{externalLink}/sync` -> 202 `{actionItem}`
- `GET w/{workspace}/teams/{team}/integrations/{integration}/targets?project_id=&q=` -> `ExportTargets`
- `POST` broadcast auth (`BroadcastAuthorizationsController.store`, configured in js/app.tsx:20-37) for `private-team-action-items.{teamId}`

The comment and sub-task routes addressed by their own id use `withoutScopedBindings()`; the export / preview / sync routes also carry `EnsureIntegrationProviderEnabled`.

The same workspace endpoint set is also used by `js/components/retro/carried-action-items-panel.tsx:73` (carry-over panel on the retro board; documented by the retro slice). The retro-scoped twin (`boardActionItemEndpoints`) is documented there too.

### Routes in this area with no front caller

None found. Every route of the slice has a caller: `workspaces.*`, `workspaces.members.*`, `workspaces.invitations.*`, `workspaces.templates.*`, `workspaces.whiteboardTemplates.*` (team page dialog), `workspaces.actionItems.*`, `workspaces.actionItemComments.*`, `workspaces.actionItemSubtasks.*`, `workspaces.actionItemExports.*`, `workspaces.actionItemLinkSyncs.store`, `invitations.acceptance.store`, `dashboard`. `invitations.show` has no front link by design (reached from the email or the flashed URL).

### Dead / unused

- No unused component or lib file in the slice.
- Unused data: `items.total` (sent, never displayed); `canManage` on the members page (sent, not typed, not read); the payload of `.team-action-item.deleted` (ignored, reload only).
- `compareActionItems` (js/lib/action-items/order.ts) is not used by the workspace page, only by the retro board reducer.
- `isActionItemAssignee` is only used internally by `permissions.ts`.

### Surprises

1. Whiteboard template rename/delete is not on the templates page; it is a dialog on the team page. The templates page is retro-only.
2. `/dashboard` is not a page: it is a redirect to the current workspace (or to workspace creation).
3. The members payload carries an always-true `canManage` that the page ignores.
4. Destructive actions without confirmation: delete action item, delete comment, delete sub-task, revoke invitation, and "Leave workspace" on the workspace page (the members page does confirm leaving). Role changes also apply immediately.
5. The global action-items page never receives tracker link updates in real time (`externalLinksChanged` is not sent on the team channel); it catches up through the window-focus reload.
6. Realtime payloads are viewer-less, so the client merge in `replaceActionItem` (keep `isMine`, `externalLinks`, `completedVia`, `commentsRevision`) is load-bearing; dropping it would hide edit controls and link chips after any remote save.
7. `creatableTeams` is membership-based: an admin/owner who is not in any team sees every item but gets no "New action item" button.
8. Managers can view items of a locked running retro but writes are rejected server-side; nothing in the UI announces it beforehand.
9. `exportSources` serialises as an empty array (not an object) when no provider is enabled; the page indexes it with `exportSources[item.teamId] ?? []`, which tolerates that.
10. The invitation "copy link" box only appears when the mailer is `log`; there is no copy button, only select-on-focus.
11. Registering through an invitation auto-accepts it; logging in does not (explicit Accept click).
12. `data-realtime` on the action-items root is consumed by the browser test suite; keep it or update the tests.

### Hardcoded untranslated strings

None found in the pages and components of this slice; every visible string goes through `t()`. Tracker names come from `TrackerLabels` (js/lib/poker/types) and `source.label` (server), which are brand names. The export option label uses a literal `"KEY — name"` separator (export-action-item-dialog.tsx:123).

### Could not verify

- Where Fortify sends the user after "Log out" from the wrong-email invitation state, and whether the `invitation_token` session value survives that logout (session invalidation is Fortify default behaviour; not traced).
- The exact runtime behaviour of Inertia v3 on a 403 from the role-change `router.patch` (no `onHttpException` handler on the members page).
- `ListExportTargets`, `ExportActionItem`, `CreateNextOccurrence`, `DeleteActionItem`, `UpdateActionItemComment`, `DeleteActionItemComment`, `DeleteActionItemSubtask`, `RenumberActionItemSubtasks`, `ResolveSsoUser` and `RetroGuard::unlocked` were not read line by line; their effects are described from call sites and names of the exceptions they raise.
- Whether every `t()` key used here exists in each `lang/*.json` file (not cross-checked).
- `WorkspaceInvitationNotification` mail content and the `js/layouts/auth-layout` chrome around the invitation page (not read).
- Which browser tests rely on `data-realtime` and on specific aria-labels in this slice (tests not inspected).
- No tests, migrations or runtime checks were run; everything is from static reading and `php artisan route:list`.


---

<!-- part: 06-teams -->

# Slice 06 — Teams (team page + team integrations)

Paths are relative to `/Users/aritti/Projects/skrum`. `C/` = `app/Http/Controllers/`, `CI/` = `app/Http/Controllers/Integrations/`, `ci/` = `resources/js/components/integrations/`, `ct/` = `resources/js/components/teams/`.

Common to both pages:

- Route group: `Route::middleware(['auth','verified'])` (routes/web.php:196) → `prefix('w/{workspace}')->middleware(['can:view,workspace', RememberCurrentWorkspace::class])->scopeBindings()` (web.php:214-217). `{workspace}` is bound by slug (front passes `workspace.slug`), `{team}` by uuid.
- "Manager" below = `User::canManage($workspace)` (app/Models/User.php:120, role `canManageWorkspace()` = workspace owner/admin). "Team viewer" = manager OR team member (`TeamPolicy::view`, app/Policies/TeamPolicy.php:11-18).
- JSON calls go through `retroRequest()` (resources/js/lib/retro/api.ts:38): Inertia's `http` client, `Accept: application/json`, adds `X-Socket-ID` when Echo is configured, 15 s timeout (`AbortSignal.timeout`), throws `RetroRequestError(status, message, errors)`; message = first validation error, else `payload.message`, else HTTP error message; timeout → status 0. `integrationErrorMessage()` (resources/js/lib/integrations.ts:4) shows the server message unless status is 0, then the translated fallback.
- Server flash toasts (`Inertia::flash('toast', {type, message})`) are shown by `useFlashToast()` (resources/js/hooks/use-flash-toast.ts, mounted in `components/ui/sonner.tsx:8`), listening to the router `flash` event.

---

## pages/teams/show.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/teams/{team}` | `teams.show` | GET | `TeamsController@show` — `Inertia::render('teams/show')` at C/TeamsController.php:67 | auth, verified, `can:view,workspace`, RememberCurrentWorkspace; `Gate::authorize('view', $team)` (TeamsController.php:62) |

Also reached by redirect from `TeamsController@store` (`to_route('teams.show')`, TeamsController.php:50).

### 2. Props (built inline in C/TeamsController.php:67-123)

| Prop | Shape | Built at | TS type (pages/teams/show.tsx:44-68) |
|---|---|---|---|
| `workspace` | `{id,name,slug}` | :68 | `WorkspaceSummary` ok |
| `team` | `{id,name}` | :69 | `TeamSummary` ok |
| `members` | `{id,name,email}[]` ordered by name | :70-71 | `MemberSummary[]` ok |
| `availableMembers` | same shape; workspace members not in the team; `[]` unless `canManage` | :72-75 | ok |
| `canManage` | bool = `can('manageMembers', team)` (manager) | :64, :76 | ok |
| `openActionItemCount` | int (action items with `completed_at` null) | :77 | ok |
| `retros` | `{id,title,phase,phaseLabel,createdAt}[]`, latest first | :78-84 | `RetroSummary[]`; `createdAt` is `?string` server-side but `string` in TS (types/workspaces.ts:42). `phase` and `createdAt` are never read by the page |
| `templateCategories` | `{value,label}[]` from `TemplateCategory::options()` (app/Enums/TemplateCategory.php:26) | :85 | `CategoryOption[]` ok |
| `catalogue` | **`Inertia::optional`** → `BuildTemplateCatalogue::handle` (app/Actions/Retros/BuildTemplateCatalogue.php:22): `{key,name,category\|null,isCommon,isWorkspace,columns:{title,description\|null,color}[]}[]`, workspace templates first, then built-ins | :86 | `catalogue?: CatalogueTemplate[]` ok |
| `llm` | `{enabled: bool, provider: string\|null}` | :87-90 | `LlmAvailability` ok |
| `canCreateRetro` | bool, `can('createRetro')` = team viewer | :91 | ok |
| `icebreakerGames` | `{value,label,available}[]` for every `GameKind` (app/Actions/Games/IcebreakerGameOptions.php:34) | :92 | `GameOption[]` ok |
| `healthStatements` | `{id,key,label,text,isBuiltin,isArchived}[]`; `id = $statement->id ?? $statement->key()` (built-ins without a DB row use their key as id) via `PresentHealthStatement` (app/Actions/HealthCheck/PresentHealthStatement.php:19) | :93-97 | `TeamHealthStatement[]` ok |
| `canManageHealthStatements` | bool, `can('update', team)` (manager) | :98 | ok |
| `pokerGames` | `{id,title,deckLabel,tasksCount,estimatedCount,totalPoints\|null,endedAt\|null,lastActivityAt}[]`, latest `updated_at` first (app/Actions/Poker/PresentPokerGameSummary.php:36) | :99-102 | `PokerGameSummary[]` ok |
| `pokerDecks` | `{id,name,cards[],canManage}[]` ordered by name; `canManage` = manager or deck creator | :103, :129-142 | `SavedPokerDeck[]` (`canManage?` optional in TS, always sent here) |
| `pokerDeckOptions` | `{value,label,cards[]}[]` in order fibonacci, modified fibonacci, t-shirt, powers of two, custom (app/Enums/PokerDeck.php:85) | :104 | `PokerDeckOption[]` ok |
| `canCreatePokerGame` | bool, team viewer | :105 | ok |
| `whiteboards` | `{id,title,updatedAt\|null,facilitatorName\|null,canDelete}[]`, latest `updated_at` first; `canDelete` = manager or the board's facilitator user (app/Actions/Whiteboards/PresentWhiteboardSummary.php:13) | :106-110 | `WhiteboardSummary[]` ok |
| `canCreateWhiteboard` | bool, team viewer | :111 | ok |
| `whiteboardTemplates` | `{id,name,description\|null,canManage}[]` ordered by name; `canManage` = manager or template creator | :112-120 | `WhiteboardTemplateSummary[]` ok |
| `whiteboardGallery` | **`Inertia::optional`** → `BuildWhiteboardGallery::handle` (app/Actions/Whiteboards/BuildWhiteboardGallery.php:33): `{key,workspaceTemplateId\|null,name,description\|null,preview:{width,height,shapes[]}}[]`, built-ins first (`workspaceTemplateId: null`), then workspace templates with `key = "workspace:{id}"` | :121 | `whiteboardGallery?: WhiteboardGalleryItem[]` ok |
| `canManageIntegrations` | bool = `IntegrationProvider::anyEnabled() && can('manageIntegrations')` | :122 | ok |

Shared props read: `locale` (new-retro-dialog.tsx:102, new-poker-game-dialog.tsx:70, poker-games-section.tsx:89, whiteboards-section.tsx:45), `errors` (health-statements-section.tsx:53), `translations` through `useTrans()`.

### 3. Layout

Default `AppLayout` from the resolver in resources/js/app.tsx:48-71 (`default:` branch). No `Page.layout`.

### 4. User actions

| Action | UI element | HTTP / route / controller | Who |
|---|---|---|---|
| Open the workspace action items filtered on this team | Link "Open action items (:count)" pages/teams/show.tsx:108-119 | GET `w/{workspace}/action-items?team={id}` `workspaces.actionItems.index` (Inertia visit) | everyone on the page |
| Open the team games | Link "Games" show.tsx:120-124 | GET `w/{workspace}/teams/{team}/games` `teams.games.index` `TeamGameRoomsController@index` | everyone |
| Open the integrations page | Link "Integrations" show.tsx:125-133 | GET `…/teams/{team}/integrations` `teams.integrations.index` | `canManageIntegrations` |
| Rename the team | `<Form>` with `name` input (required, maxLength 100) + "Rename" show.tsx:136-159 | PATCH `w/{workspace}/teams/{team}` `teams.update` `TeamsController@update` (:144, `name` required string max 100, `back()`) | `canManage`; server: `update` policy (manager) |
| Open "New retrospective" dialog | `NewRetroDialog` ct/new-retro-dialog.tsx:58-77; the form mounts only while open | on mount, if `catalogue` is undefined: `router.reload({ only: ['catalogue'] })` (:120-124) — partial reload of GET `teams.show` | `canCreateRetro` |
| Edit the retro title | input, default `t('Retro :date')` with today's date in `locale` (`dateStyle: 'medium'`), maxLength 120 (:105-110, :185-194) | client-only | idem |
| Search templates | search input (:201-208); matches template name or any column title, case-insensitive (`matchesQuery` :79-90) | client-only | idem |
| Filter templates by category | toggle buttons "All" + `templateCategories`, `aria-pressed` (:210-234) | client-only | idem |
| Pick a template | list buttons grouped "Workspace templates" / "Common templates" / "More templates" (:139-157, :245-298); each shows name, category label and column titles joined by ` · ` or "Empty board" | client-only (`form.setData('template')`) | idem |
| Preview the chosen template | right pane (:303-325): name + `TemplateChips withDescriptions` (resources/js/components/templates/template-chips.tsx:11-36), or "Start with an empty board and add your own columns." | client-only | idem |
| Open "Settings" | `Collapsible` (:328-448) | client-only | idem |
| Toggle "Anonymous cards" | checkbox (:341-350) → `is_anonymous` | sent on submit | idem |
| Toggle "Health check" | checkbox (:353-365) → `health_check_enabled` | sent on submit | idem |
| Toggle "Icebreaker" and choose its game | checkbox (:368-380) + `IcebreakerGameSelect` (resources/js/components/retro/icebreaker-game-select.tsx; shows only `available` options plus the current value, unavailable ones disabled) → `icebreaker_enabled`, `icebreaker_game` (default `'draw'`) | sent on submit | idem |
| Vote limit: automatic or fixed | checkbox "Automatic vote limit" (:395-409): checked → `votes_per_participant: null`; unchecked → 5 (`DefaultFixedVotes` :36) and a number input min 1 max 20 (:418-431) | sent on submit | idem |
| Toggle "Automatic AI summary" | `AiSummarySwitch` (resources/js/components/retro/ai-summary-switch.tsx), shown only when `llm.enabled && llm.provider` (:437-446); default `llm.enabled` | sent on submit | idem |
| Start the retro | "Start" submit, disabled while processing or no template selected (:454-459) | POST `w/{workspace}/teams/{team}/retros` `teams.retros.store` `TeamRetrosController@store` (C/TeamRetrosController.php:21) → redirect `retros.show`; `onSuccess` closes the dialog. Body: `title, template, is_anonymous, health_check_enabled, icebreaker_enabled, icebreaker_game, votes_per_participant, ai_summary_enabled` | `canCreateRetro`; server `createRetro` (team viewer) |
| Cancel the dialog | "Cancel" (:451-453) | client-only | idem |
| Open a retro | list Link, title + `phaseLabel` badge show.tsx:181-197 | GET `retros/{retro}` `retros.show` | everyone |
| Open "New game" dialog | `NewPokerGameDialog` ct/new-poker-game-dialog.tsx:38-60 | client-only | `canCreatePokerGame` |
| Poker title | input default `t('Poker :date')`, maxLength 120 (:72-77, :102-110) | client-only | idem |
| Choose the deck | `DeckFields` (resources/js/components/poker/deck-fields.tsx:152) `role="radiogroup"` of `role="radio"` buttons: built-in decks, then "Your team's decks" (saved decks), then "Custom" last | client-only | idem |
| Custom deck fields | shown when custom and no saved deck (:231-294): "Custom cards" comma-separated input, "Add ?" and "Add ☕" checkboxes (default on), and with `allowSaveAs` "Save this deck for the team as…" (maxLength 40) | client-only | idem |
| Toggle "Anonymous votes" / "Reveal automatically" | checkboxes new-poker-game-dialog.tsx:125-147 | sent on submit | idem |
| Create the game | "Create game" (:154) | POST `…/teams/{team}/poker-games` `teams.pokerGames.store` `TeamPokerGamesController@store` (C/TeamPokerGamesController.php:20) → redirect `poker.show`. Body = `title, anonymous_votes, auto_reveal` + `deckPayload()` (deck-fields.tsx:58-80): saved deck → `{deck:'custom', saved_deck_id}`; built-in → `{deck}`; custom → `{deck:'custom', custom_cards[], include_unknown, include_coffee, save_deck_as?}` | `canCreatePokerGame`; server `createPokerGame` |
| Open estimation history | Link "Estimation history" ct/poker-games-section.tsx:50-59 | GET `…/teams/{team}/estimates` `teams.estimates.index` | everyone |
| Open "Saved decks" dialog | `SavedDecksDialog` ct/saved-decks-dialog.tsx:55-73 | client-only | everyone (rendered regardless of `canCreate`) |
| Create a saved deck | "New deck" → inline `DeckDraftForm` (:188-198, :203-325): name (maxLength 40), cards (comma-separated, required), "Add ?" / "Add ☕" | POST `…/teams/{team}/poker-decks` `teams.pokerDecks.store` `PokerDecksController@store` (C/PokerDecksController.php:17), `router.post` with `preserveScroll`; body `{name, cards[], include_unknown, include_coffee}` | any team viewer (`PokerDeckPolicy::create`); max 30 decks per team (`SavedPokerDeckRules::MaxDecks`) |
| Edit a saved deck | "Edit deck" → same inline form prefilled (`draftFrom` :42-49) | PATCH `…/poker-decks/{pokerDeck}` `teams.pokerDecks.update` `PokerDecksController@update` (:44) | `deck.canManage` (manager or creator); server `PokerDeckPolicy::update` |
| Delete a saved deck | "Delete deck" → inline confirm "Delete this deck? Games that use it keep their cards." → "Delete deck" / "Cancel" (:144-181) | DELETE `…/poker-decks/{pokerDeck}` `teams.pokerDecks.destroy` `PokerDecksController@destroy` (:71) | idem |
| Open a poker game | Links in "Active games" / "Ended games" lists (poker-games-section.tsx:81-140) | GET `poker/{game}` `poker.show` | everyone |
| Open "New whiteboard" dialog | `NewWhiteboardDialog` ct/new-whiteboard-dialog.tsx:33-50 | on mount, if `gallery` undefined: `router.reload({ only: ['whiteboardGallery'] })` (:66-70) | `canCreateWhiteboard` |
| Whiteboard title | input, required, maxLength 120, `autoFocus`, starts empty (:124-133) | client-only | idem |
| Pick a whiteboard template | tiles `role="radio"` in a `role="radiogroup"` (:84-106), built-ins then "Workspace templates"; each tile shows an SVG `WhiteboardTemplatePreview` (ct/whiteboard-template-preview.tsx), name and description. Default `template: 'blank'` | client-only | idem |
| Create the whiteboard | "Create" (:174) | POST `…/teams/{team}/whiteboards` `teams.whiteboards.store` `TeamWhiteboardsController@store` (C/TeamWhiteboardsController.php:23) → redirect `whiteboards.show`. Body `{title, template, workspace_template_id}`; exactly one of the last two is non-null | `canCreateWhiteboard`; server `createWhiteboard` |
| Open "Whiteboard templates" dialog | `WhiteboardTemplatesDialog` ct/whiteboard-templates-dialog.tsx:26-44 | client-only | everyone (always rendered) |
| Edit a whiteboard template | "Edit" → inline form name (maxLength 80, required) + description (maxLength 300) (:161-235) | PATCH `w/{workspace}/whiteboard-templates/{whiteboardTemplate}` `workspaces.whiteboardTemplates.update` `WorkspaceWhiteboardTemplatesController@update` (C/WorkspaceWhiteboardTemplatesController.php:15), `router.patch`, `preserveScroll` | `template.canManage`; server `WhiteboardTemplatePolicy::update` |
| Delete a whiteboard template | "Delete" → inline confirm "Delete this template? Boards already created from it are not changed." (:117-152) | DELETE same URI `workspaces.whiteboardTemplates.destroy` (:37) | idem |
| Open a whiteboard | Link, title + "Facilitated by :name · date" ct/whiteboards-section.tsx:100-120 | GET `whiteboards/{board}` `whiteboards.show` | everyone |
| Delete a whiteboard | trash icon button (`aria-label` "Delete :title") → confirm dialog "Delete this board? Everything on it is removed for everyone." (:121-169) | **JSON** DELETE `whiteboards/{board}` `whiteboards.destroy` `Whiteboards\WhiteboardsController@destroy` via `retroRequest`, then `router.reload({ only: ['whiteboards'] })`; error → `toast.error` | `board.canDelete`; server `WhiteboardGuard::canDelete` |
| Reorder health statements | drag handle (`GripVertical`, `aria-label` "Drag to reorder") on active rows, dnd-kit pointer (6 px activation distance) + keyboard sensors (ct/health-statements-section.tsx:67-72, :290-301) | PUT `…/teams/{team}/health-statement-order` `teams.healthStatements.order.update` `TeamHealthStatementOrdersController@update` (`ids` array of strings max 64), `router.put` with `preserveScroll` (:108-112) | `canManageHealthStatements`; server `update` policy |
| Add a health statement | `<Form resetOnSuccess>` text (maxLength 150) + axis label (maxLength 30) + "Add statement" (:158-193) | POST `…/teams/{team}/health-statements` `teams.healthStatements.store` `TeamHealthStatementsController@store` (C/TeamHealthStatementsController.php:17) | idem |
| Edit a custom statement | "Edit" (hidden for built-ins) → inline `<Form>` text + label, "Save" / "Cancel" (:303-363) | PATCH `…/health-statements/{statement}` `teams.healthStatements.update` (:30) | idem |
| Archive a statement | "Archive" `<Form>` on every active row, built-ins included (:364-380) | PUT `…/health-statements/{statement}/archival` `teams.healthStatements.archival.update` `TeamHealthStatementArchivalsController@update` | idem |
| Show archived statements | `Collapsible` "Archived (:count)" (:195-238) | client-only | everyone |
| Restore a statement | "Restore" `<Form>` (:212-232) | DELETE `…/health-statements/{statement}/archival` `teams.healthStatements.archival.destroy` | `canManageHealthStatements` |
| Remove a team member | "Remove" `<Form>` per member show.tsx:238-255 (no confirmation) | DELETE `…/teams/{team}/members/{member}` `teams.members.destroy` `TeamMembersController@destroy` (C/TeamMembersController.php:32) | `canManage`; server `manageMembers` |
| Add a team member | `<Select name="user_id">` + "Add" show.tsx:260-299 (only when `availableMembers.length > 0`) | POST `…/teams/{team}/members` `teams.members.store` (:15; `user_id` must be a workspace member) | idem |
| Delete the team | "Delete team" → `ConfirmFormDialog` (resources/js/components/confirm-form-dialog.tsx) show.tsx:302-316 | DELETE `w/{workspace}/teams/{team}` `teams.destroy` `TeamsController@destroy` (:155) → redirect `workspaces.show` | `canManage`; server `delete` policy |

Optimistic / refetch behaviour:

- Health statement reorder is optimistic: `pendingOrder` holds the new id order until `onFinish` clears it (health-statements-section.tsx:58-66, :107-112).
- Saved decks and whiteboard templates: on an HTTP exception (403/404…) `onHttpException` closes the form, calls `router.reload({ only: ['pokerDecks'] })` or `{ only: ['whiteboardTemplates','whiteboardGallery'] }` and returns `false` to suppress the Inertia error modal (saved-decks-dialog.tsx:51-53, :88-93, :242-247; whiteboard-templates-dialog.tsx:22-24, :60-65, :192-197).
- Deferred-style props: `catalogue` and `whiteboardGallery` are loaded on first dialog open, with skeletons (new-retro-dialog.tsx:236-239, :305-307; new-whiteboard-dialog.tsx:138-144).
- No debounce, no polling, no localStorage on this page.

### 5. Realtime

None. No Echo/Reverb subscription, whisper or presence in `pages/teams/**`, `components/teams/**`, `components/templates/template-chips.tsx` or `components/poker/deck-fields.tsx` (grep for `Echo`, `useEcho`, `.channel(`, `private(`, `presence(` returns nothing). The lists (retros, poker games, whiteboards) only refresh on navigation or the partial reloads listed above.

### 6. Role / permission-conditional UI

| Flag | Drives | Server check |
|---|---|---|
| `canManage` | rename form, "Remove" per member, add-member form, "Delete team" | `TeamPolicy::manageMembers` / `update` / `delete` = workspace manager |
| `canManageIntegrations` | "Integrations" link | `TeamPolicy::manageIntegrations` (manager) AND at least one provider configured |
| `canCreateRetro` / `canCreatePokerGame` / `canCreateWhiteboard` | the three "New …" dialogs | `TeamPolicy::createRetro` / `createPokerGame` / `createWhiteboard` = team viewer (always true for anyone who can open the page) |
| `canManageHealthStatements` | drag handles, add form, Edit / Archive / Restore | `TeamPolicy::update` (manager) |
| `deck.canManage` | "Edit deck" / "Delete deck" | `PokerDeckPolicy` (manager or creator who can still view the team) |
| `template.canManage` | whiteboard template "Edit" / "Delete" | `WhiteboardTemplatePolicy` (manager or creator still in the workspace) |
| `board.canDelete` | whiteboard trash button | `WhiteboardGuard::canDelete` |
| `statement.isBuiltin` | "Built-in" badge, no "Edit" button | — |
| `llm.enabled && llm.provider` | AI summary switch | `TeamRetrosController` defaults `ai_summary_enabled` to true when absent |
| `availableMembers.length > 0` | add-member form visibility | — |

### 7. Other state worth preserving

- Empty states: "No retrospectives yet.", "No games yet.", "No whiteboards yet.", "No saved decks yet.", "No whiteboard templates yet." + "Save a board as a template from its menu.", "No templates match your search.".
- Poker games are split client-side into "Active games" (`endedAt === null`) and "Ended games"; each row shows deck label, ":tasks tasks · :estimated estimated", optional ":points points" (`formatPoints`), "Last activity :date".
- Template selection fallback in the retro dialog: chosen key → first non-workspace template → first visible item when the chosen one is filtered out (new-retro-dialog.tsx:131-138). The submitted `template` is always the *visible* selection (`form.transform`, :169).
- Health statements a11y: dnd-kit `announcements` (picked up / moved to position / dropped / cancelled) and `screenReaderInstructions` (health-statements-section.tsx:77-93, :131-137); errors `errors.statements ?? errors.ids` from page props are shown above the list (:125). Section description: "Changes apply to retros that have not collected answers yet."
- Health statement mutations flash success toasts server-side ("Statement added/updated/archived/restored.", "Statements reordered.").
- Deck validation errors are flattened: `custom_cards.*` → one message (deck-fields.tsx:138-150), `cards.*` → one message (saved-decks-dialog.tsx:219-221). `save_deck_as` is rejected server-side unless the deck is custom and not a saved deck (TeamPokerGamesController.php:63-74).
- Special cards are `'?'` and `'☕'` (resources/js/lib/poker/types.ts:190).
- The whiteboard dialog does not close itself on success (it relies on the redirect); the delete-board dialog cannot be dismissed while the request is running (whiteboards-section.tsx:141-145).
- `WhiteboardTemplatePreview` renders rect / ellipse / diamond / path / text shapes in an `aria-hidden` SVG on a forced white background; text shapes are grey bars `#ced4da`.

---

## pages/teams/integrations.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/teams/{team}/integrations` | `teams.integrations.index` | GET | `Integrations\TeamIntegrationsController@index` — `Inertia::render('teams/integrations')` at CI/TeamIntegrationsController.php:35 | auth, verified, `can:view,workspace`, RememberCurrentWorkspace, `EnsureIntegrationProviderEnabled` (404 when no provider is configured); `Gate::authorize('manageIntegrations', $team)` (:30) |

Redirect targets landing here: `IntegrationCallbacksController@show` (CI/IntegrationCallbacksController.php) after OAuth, with a flash toast (success ":provider connected.", info "Choose a Jira site to finish connecting.", or error "Could not connect :provider. Try again." / the provider's refusal message). If the team cannot be resolved or the user lost the right, it redirects to `dashboard`.

### 2. Props (CI/TeamIntegrationsController.php:35-57)

| Prop | Shape | TS (pages/teams/integrations.tsx:26-33) |
|---|---|---|
| `workspace` | `{id,name,slug}` | ok |
| `team` | `{id,name}` | ok |
| `providers` | one card per **enabled** provider, in enum order slack, telegram, jira, linear, jira_dc, github, msteams, mattermost, webhook: `{provider, label, usesOAuth, isTracker, authMethods: ('oauth'\|'pat')[], connection: TeamIntegration\|null}` | `IntegrationProviderCard[]` ok. `usesOAuth` and `isTracker` are never read by the front; `authMethods` is non-empty only for `jira_dc` |
| `telegram` | `{botUsername: string\|null, conflict: bool}` or `null` when Telegram is disabled | `TelegramBotInfo \| null` ok |
| `mattermost` | `{url}` or `null` | ok |
| `webhookEvents` | `{name, description}[]` (`WebhookEvent::options()`, app/Enums/WebhookEvent.php:38) or `null` | ok |
| `pollMinutes` | int (`InboundReachability::pollIntervalMinutes()`, config `services.…poll_minutes`, env `INTEGRATIONS_POLL_MINUTES`, default 5) | declared through `StatusSyncPageProps`; not destructured by the page, read with `usePage()` in ci/status-sync-section.tsx:37 |

`connection` (`PresentTeamIntegration::handle`, app/Actions/Integrations/PresentTeamIntegration.php:58-79): `{id, provider, status ('active'\|'setup_required'\|'reconnect_required'), statusLabel, access ('read'\|'write'), settings, connectedBy (name\|null), connectedAt, lastCheckedAt, lastError, webhook: {consecutiveFailures, lastDeliverySucceededAt}\|null (generic webhook only), statusSync, inboundMode ('webhook'\|'polling'\|'off'), webhookStatus ('pending'\|'active'\|'failing'\|null), lastInboundAt, lastPolledAt, inboundHint ('reconnect'\|'manual'\|null)}`. Matches `TeamIntegration` (resources/js/types/integrations.ts:62-80).

`settings` is whitelisted per provider (`SettingKeys`, PresentTeamIntegration.php:25-35):

- slack: `teamName, channelName, configurationUrl`
- telegram: `chatId, chatTitle, chatType`
- jira: `cloudId, siteName, siteUrl, sites[], storyPointFields[], numberFields[], priorityMap, treatCanceledAsDone, statusMapping`
- linear: `organizationName, urlKey, priorityMap, treatCanceledAsDone, statusMapping`
- jira_dc: `serverTitle, version, baseUrl, authMethod, storyPointFields[], numberFields[], priorityMap, treatCanceledAsDone, statusMapping` + `tokenOwner`, `tokenSavedAt` when `authMethod === 'pat'`
- github: `installationId, accountLogin, accountType, exportRepositoryId, priorityLabels, treatCanceledAsDone` + computed `exportRepositoryName`
- msteams / mattermost: `host, channelLabel`
- webhook: `host, channelLabel, secretCreatedAt, events[], disabledReason`

Sent but never read by the front: `connectedAt`, `webhook.consecutiveFailures`, `settings.disabledReason`, `settings.urlKey`, `settings.chatType`, `settings.exportRepositoryId`.

Shared props read: `locale` (integration-details.tsx:19, webhook-integration.tsx:55, webhook-deliveries-panel.tsx:39, jira-data-center-integration.tsx:106, status-sync-section.tsx:37).

### 3. Layout

Default `AppLayout` (resources/js/app.tsx:69-70).

### 4. User actions

Page-level and shared pieces:

| Action | UI element | HTTP / route | Who |
|---|---|---|---|
| Back to the team | Link "Back to the team" integrations.tsx:62-66 | GET `teams.show` | manager (whole page is manager-only) |
| Test a connection | `TestConnectionButton` ci/integration-actions.tsx:55-96, label "Send a test message" (channels) or "Test the connection" (trackers) | JSON POST `…/integrations/{integration}/test` `teams.integrations.test.store` `IntegrationTestsController@store` (throttle 10/min); success toast, then **always** `router.reload({ only: ['providers'] })` in `finally` | manager |
| Disconnect | `DisconnectIntegrationDialog` ci/disconnect-integration-dialog.tsx; per-provider description, optional custom label/title | JSON DELETE `…/integrations/{integration}` `teams.integrations.destroy` `TeamIntegrationsController@destroy` (204); toast ":provider disconnected."; reload `providers` | manager |
| Start an OAuth connection | `ConnectLink` integration-actions.tsx:29-46 — a plain `<a href>` (not an Inertia visit) | GET `…/integrations/{provider}/connect[?access=read\|write]` `teams.integrations.connect` `IntegrationAuthorizationsController@create` → `redirect()->away(authorization URL)` | manager |

Every "save" below is a JSON PATCH `…/integrations/{integration}` `teams.integrations.update` `TeamIntegrationsController@update` (throttle 60/min, key `integrationUpdates`), which returns the presented integration; the front ignores the response body and reloads `providers`.

Slack (ci/slack-integration.tsx):

| Action | UI | HTTP |
|---|---|---|
| Connect / Reconnect | `ConnectLink` "Connect" (:24-28) / "Reconnect" (:48-53) | OAuth redirect, no `access` param |
| Open the channel configuration in Slack | external link on the channel name when `configurationUrl` is set (:80-90) | external |
| Send a test message | only when `status === 'active'` (:54-61) | test endpoint |
| Disconnect | (:62-70) | destroy endpoint |

Telegram (ci/telegram-integration.tsx):

| Action | UI | HTTP |
|---|---|---|
| Create a connect code | "Connect" / "Connect another chat" (:107-117), disabled when `telegram.botUsername === null` | JSON POST `…/integrations/telegram/code` `teams.integrations.telegramCode.store` `TelegramConnectCodesController@store` (throttle 10/min) → `{code, command: "/connect@{bot} {code}", botUsername, expiresAt}` (15-minute TTL, `TelegramConnectCodes::TtlMinutes`) |
| Copy the command | "Copy" / "Copied" button (:192-201) | clipboard |
| Open the bot | link `https://t.me/{botUsername}` (:203-213) | external |
| Wait for the connection | `usePoll(5000, { only: ['providers'] }, { autoStart: false })` (:61-65), started after the code is issued; stops when the connection identity changes to an active one (toast "Telegram connected.") or when the countdown hits 0 | Inertia partial reload every 5 s |
| Send a test message / Disconnect | (:129-145) | test / destroy |

Microsoft Teams and Mattermost (ci/url-channel-integration.tsx):

| Action | UI | HTTP |
|---|---|---|
| Connect | "Connect" → dialog with "Webhook URL" (type url, required) and "Channel label (optional)" (maxLength 80) (:139-141, :186-244) | JSON POST `…/integrations/{provider}` (`msteams`\|`mattermost`) `teams.integrations.urls.store` `IntegrationUrlsController@store` (throttle 10/min) body `{url, channel_label\|null}` → 201 |
| Replace URL / edit label | "Replace URL" → same dialog; URL optional and never prefilled, label prefilled (:144-150, :77-82) | PATCH update, body `{url?, channel_label\|null}` |
| Send a test message / Disconnect | (:151-167) | test / destroy |

Generic outgoing webhook (ci/webhook-integration.tsx and children):

| Action | UI | HTTP |
|---|---|---|
| Connect | "Connect" → dialog "Endpoint URL" + "Label (optional)" (:141-143, :232-293) | JSON POST `…/integrations/webhook` `teams.integrations.urls.store` → 201 with the integration **plus `secret`**; opens `WebhookSecretDialog` |
| Copy the signing secret | `WebhookSecretDialog` ci/webhook-secret.tsx:37-107: read-only input (select on focus), "Copy", verification pseudo-code, "I've saved the secret"; Escape and outside click are blocked | clipboard |
| Re-enable a disabled webhook | "Re-enable" when `status === 'reconnect_required'` (webhook-integration.tsx:146-151, :303-335) | PATCH update `{enabled: true}` |
| Replace URL / label | "Replace URL" (:152-158) | PATCH update `{url?, channel_label}` |
| Send a test message | always shown for a connected webhook, whatever its status (:159-164) | test endpoint |
| Rotate the secret | "Rotate secret" → confirm dialog (webhook-secret.tsx:115-179) | JSON POST `…/integrations/{integration}/secret` `teams.integrations.secret.store` `WebhookSecretsController@store` (throttle 10/min) → `{secret}`; secret dialog opens again |
| Choose automatic events | checkboxes per `webhookEvents` + "Save events" (enabled only when changed) ci/webhook-events-panel.tsx:106-151 | PATCH update `{events: string[]}` |
| Show the payload reference | `Collapsible` "Payload reference" (:132-143) | client-only |
| Show / hide deliveries | "Show deliveries" / "Hide deliveries" (`aria-expanded`) ci/webhook-deliveries-panel.tsx:220-227 | JSON GET `…/integrations/{integration}/deliveries?page=N` `teams.integrations.deliveries.index` `WebhookDeliveriesController@index` (25 per page, throttle 60/min) → `{data[], currentPage, lastPage, total}` |
| Paginate deliveries | "Previous" / "Next", "Page :page of :pages" (:350-373) | same endpoint |
| Retry a failed load | "Retry" (:230-241) | same endpoint |
| View a delivery | "View" (only when `hasContent`) → `WebhookDeliveryDialog` ci/webhook-delivery-dialog.tsx | JSON GET `…/deliveries/{delivery}` `teams.integrations.deliveries.show` → `{id,event,status,attempts,redeliveryOf,request:{headers,body},response:{status,excerpt}}` |
| Switch Request / Response tab | `role="tablist"` with roving tabindex; ArrowLeft/ArrowRight/Home/End (:53-69, :106-131) | client-only |
| Copy the request body | "Copy" (:179-190) | clipboard |
| Redeliver | "Redeliver" (when `delivery.redeliverable && connection.status === 'active'`) → confirm dialog "Send this delivery again to :host?" (webhook-deliveries-panel.tsx:163-164, :384-428) | JSON POST `…/deliveries/{delivery}/redelivery` `teams.integrations.deliveries.redelivery.store` `WebhookRedeliveriesController@store` (throttle 10/min) → 202; toast "Delivery queued again."; reloads page 1 |
| Disconnect | (:170-178) | destroy |

Jira Cloud (ci/jira-integration.tsx):

| Action | UI | HTTP |
|---|---|---|
| Connect read only / read and write | two `ConnectLink`s (:46-58) | OAuth redirect `?access=read` / `?access=write` |
| Reconnect | `ConnectLink` with the current access (:115-121) | OAuth redirect |
| Upgrade to read and write | shown when `access === 'read'` (:122-130) | OAuth redirect `?access=write` |
| Choose the Jira site | `Select` of `settings.sites`, only while `status === 'setup_required'` (:150-173) | PATCH update `{cloud_id}`; toast "Jira connected." |
| Open the Jira site | external link (:181-193) | external |
| Story points field, People, Priorities, Status sync | see shared panels below | |
| Test the connection / Disconnect | (:131-146) | test / destroy |

Jira Data Center (ci/jira-data-center-integration.tsx):

| Action | UI | HTTP |
|---|---|---|
| Connect with OAuth (read only / read and write) | `ConnectLink`s when `authMethods` includes `'oauth'` (:47-63) | OAuth redirect |
| Connect with a personal access token | `JiraTokenDialog` (ci/jira-token-dialog.tsx) when `authMethods` includes `'pat'`; label "Older Jira server? Use a personal access token" (link variant) or "Use a personal access token" (:64-76). Fields: token (password, minLength 20, maxLength 255), access toggle group Read only / Read and write, warning note, "I understand" checkbox (submit disabled until ticked) | JSON POST `…/integrations/jira-dc/token` `teams.integrations.jiraDataCenterToken.store` `JiraDataCenterTokensController@store` (throttle 10/min) body `{token, access, acknowledged}` → 201; toast "Token saved." |
| Replace token | same dialog, when connected with a token (:125-131) | same endpoint |
| Reconnect / Upgrade to read and write | OAuth connections only (:132-151) | OAuth redirect |
| Open the Jira server | external link (:210-222) | external |
| Remove token / Disconnect | dialog label and title change for token connections (:160-176) | destroy |
| Story points field, People, Priorities | shared panels | |
| Status sync | passed by the page as `statusSection` (pages/teams/integrations.tsx:127-135), rendered when active | |

Linear (ci/linear-integration.tsx): Connect read only / read and write, Reconnect, Upgrade to read and write (OAuth redirects, :28-74); Test the connection; Disconnect; People, Priorities, Status sync panels.

GitHub (ci/github-integration.tsx):

| Action | UI | HTTP |
|---|---|---|
| Install the GitHub App | `ConnectLink` without `access` (:33-37) | OAuth/install redirect; callback reads `installation_id` |
| Manage the installation | `ConnectLink` (:63-68) | same route |
| Open the installation on GitHub | external link built client-side from `accountType`, `accountLogin`, `installationId` (:51-54, :95-103) | external |
| Save priority labels | `GitHubPriorityLabels` ci/github-priority-labels.tsx: three text inputs High / Medium / Low (maxLength 50) + "Save" | PATCH update `{priority_labels: {high, medium, low}}` (empty → `null`); 422 errors mapped from `priority_labels.{level}` |
| Test the connection / Disconnect | (:69-85) | test / destroy |
| People, Status sync | shared panels; status sync passed as `statusSection` by the page | |

Shared tracker panels:

| Action | UI | HTTP |
|---|---|---|
| Choose the story points field | `StoryPointsField` ci/story-points-field.tsx: `Select` of `settings.numberFields`, value `storyPointFields[0].id`; "No story points field found." when empty | PATCH update `{story_point_field_id}`; toast "Story points field saved." |
| Detect fields again | "Detect again" (active connections only) (:92-102) | JSON POST `…/integrations/{integration}/detection` `teams.integrations.detection.store` `JiraFieldDetectionsController@store` |
| Load the people mapping | `PeoplePanel` ci/people-panel.tsx on mount (:93-123) | JSON GET `…/user-mappings` `teams.integrations.userMappings.index` → `{members: {userId,name,email,avatarUrl,mapping}[], matching}` |
| Match by email / Match GitHub sign-ins | button (:223-237), disabled while matching | JSON POST `…/user-mappings/match` `teams.integrations.userMappings.match.store` (throttle 3/min) → 202 `{matching: true}`; the panel then refetches the mappings every 5 s while `matching` is true (`MatchingPollMs`, :30, :125-136) |
| Choose an account for a member | row dropdown (`UserSearch` icon, `aria-label` "Change the :provider account of :name") → "Choose an account…" → `AccountPickerDialog` ci/account-picker-dialog.tsx | search: JSON GET `…/accounts?q=` `teams.integrations.accounts.index` (throttle 30/min), 300 ms debounce, minimum 2 characters, input maxLength 100 → `{accountId, displayName}[]`; choose: JSON PUT `…/user-mappings/{user}` `teams.integrations.userMappings.update` body `{external_account_id}` → the updated row |
| Never assign | dropdown item (:300-306) | PUT same with `{external_account_id: null}` |
| Reset a mapping | dropdown item, only when a mapping exists (:307-313) | JSON DELETE `…/user-mappings/{user}` `teams.integrations.userMappings.destroy` (204); row set to `mapping: null` locally |
| Map a priority | `PrioritiesPanel` ci/priorities-panel.tsx: one `Select` per level High / Medium / Low with "Default (:name)", "Don't set" (Jira and Jira DC only) and the provider's priorities | load: JSON GET `…/priorities` `teams.integrations.priorities.index`; save: PATCH update `{priority_map: {[level]: value}}` where value is `'default'`, `null`, a Jira priority id (string) or a Linear priority number |
| Turn status sync on | `StatusSyncSection` ci/status-sync-section.tsx: checkbox "Sync status" → confirm dialog "Turn on status sync with :provider?" (:113-168) | PATCH update `{status_sync: true}` |
| Turn status sync off | same checkbox, no confirmation | PATCH update `{status_sync: false}` |
| Treat canceled as done | checkbox, Linear and GitHub only, default checked (`!== false`) (:197-217) | PATCH update `{treat_canceled_as_done}` |
| Load status-mapping containers | `StatusMappingPanel` ci/status-mapping-panel.tsx on mount (Jira, Jira DC, Linear, only while sync is on) | JSON GET `…/statuses` `teams.integrations.statuses.index` (throttle 30/min) → `{containers: string[]}`; "Try again" on error |
| Edit a container's mapping | "Edit mapping" per container (:254-263) | JSON GET `…/statuses?container=KEY` → `{statuses: {id,name,category}[]}` |
| Choose which statuses count as done | checkboxes over `category === 'done'` statuses, Jira only; the last checked one is disabled ("At least one status must count as done.") (:267-305) | PATCH update `{status_mapping: {container, done_status_ids, complete_status_id, reopen_status_id}}`; all checked → `done_status_ids: null` |
| Choose "Complete to" / "Reopen to" | two `Select`s with "Automatic", an "Unknown status (:id)" entry when the saved id is gone, and the statuses (:209-248) | PATCH update; Jira keys `complete_status_id` / `reopen_status_id`, Linear keys `complete_state_id` / `reopen_state_id`; "Automatic" → `null` |
| Show Jira DC webhook details | `JiraDataCenterWebhookPanel` ci/jira-data-center-webhook-panel.tsx, shown when `inboundHint === 'manual'`: "Show webhook details" | JSON GET `…/integrations/{integration}/webhook` `teams.integrations.trackerWebhook.show` (throttle 10/min, `Cache-Control: no-store`) → `{url, secret, events[], jql\|null}` |
| Copy URL / events / JQL / secret | `CopyRow` icon buttons (`aria-label` "Copy :label") (:118-151) | clipboard; toast ":label copied." |
| Confirm the manual registration | "I've registered it", only when `webhookStatus === null` (:105-113) | JSON POST `…/integrations/{integration}/webhook` `teams.integrations.trackerWebhook.store` body `{registered: true}` → 202; toast "skrum now waits for the first event." |

Per-provider matrix:

| Provider | Enabled when (app/Enums/IntegrationProvider.php:52-66, config/services.php) | Kind | How it connects | Configurable options | JSON endpoints used |
|---|---|---|---|---|---|
| Slack | `services.slack.client_id` + `client_secret` | channel | OAuth redirect (`connect` → `integrations/slack/callback`); Slack asks for the channel | none (reconnect to change channel) | test, destroy |
| Telegram | `services.telegram.bot_token` | channel | connect code typed in the chat as `/connect@bot CODE`; the page polls `providers` every 5 s | none | telegramCode.store, test, destroy |
| Jira Cloud | `services.jira.client_id` + `client_secret` | tracker | OAuth redirect with `access=read\|write`; multi-site accounts land in `setup_required` and must choose a site | site (`cloud_id`), story points field, people mapping, priority map, status sync, status mapping | update, detection.store, userMappings.*, accounts.index, priorities.index, statuses.index, test, destroy |
| Linear | `services.linear.client_id` + `client_secret` | tracker | OAuth redirect with `access` | people mapping, priority map, status sync, treat canceled as done, status mapping | update, userMappings.*, accounts.index, priorities.index, statuses.index, test, destroy |
| Jira Data Center | `services.jira_dc.base_url` is a valid server URL AND at least one auth method: OAuth (`client_id` + `client_secret`) or PAT (`services.jira_dc.personal_tokens`, env `JIRA_DC_PERSONAL_TOKENS`, default true) | tracker | OAuth redirect (callback `integrations/jira-dc/callback`) or token form | story points field, people mapping, priority map, status sync, status mapping, manual webhook registration | jiraDataCenterToken.store, update, detection.store, userMappings.*, accounts.index, priorities.index, statuses.index, trackerWebhook.show/store, test, destroy |
| GitHub | `services.github_app.app_id`, `slug`, `client_id`, `client_secret` and a private key (inline or path) | tracker | GitHub App install redirect; access comes from the installation's permissions | people mapping, priority labels, status sync, treat canceled as done | update, userMappings.*, accounts.index, test, destroy |
| Microsoft Teams | `services.msteams.enabled === true` (env `MSTEAMS_ENABLED`) | channel | pasted Workflows webhook URL (form) | URL, channel label | urls.store, update, test, destroy |
| Mattermost | `services.mattermost.url` is a valid server URL (env `MATTERMOST_URL`) | channel | pasted incoming webhook URL (form) | URL, channel label | urls.store, update, test, destroy |
| Webhook | `services.outgoing_webhooks.enabled === true` (env `OUTGOING_WEBHOOKS_ENABLED`) | channel | pasted endpoint URL (form); secret shown once | URL, label, events, re-enable, secret rotation, deliveries log, redelivery | urls.store, update, secret.store, deliveries.index/show, redelivery.store, test, destroy |

Feature flagging: there is no dedicated feature-flag table. `EnsureIntegrationProviderEnabled` (app/Http/Middleware/EnsureIntegrationProviderEnabled.php) resolves the provider from its middleware parameter, the `{provider}` route parameter, or the bound `{integration}`; it answers 404 when that provider is not configured, and when no provider can be resolved it requires `IntegrationProvider::anyEnabled()`. It wraps the whole team integrations group (routes/web.php:235) and both callbacks (:204-212). The page only receives cards for enabled providers.

OAuth callbacks: GET `integrations/{provider}/callback` (`integrations.callback`, provider in slack/jira/linear/github) and GET `integrations/jira-dc/callback` (`integrations.jiraDataCenter.callback`), both `IntegrationCallbacksController@show`, under auth + verified. State and PKCE verifier are kept in the session (`OAuthState`); the callback re-checks `manageIntegrations` on the team stored in the state.

### 5. Realtime

None. No Echo channel is subscribed on this page. Freshness comes from polling and partial reloads:

- `router.reload({ only: ['providers'] })` after every mutation.
- Telegram: `usePoll(5000, { only: ['providers'] })` while a connect code is pending.
- People panel: 5 s JSON refetch while matching runs.

`app/Events/Integrations/IntegrationActivated` exists but is a plain domain event (`ShouldDispatchAfterCommit`, not `ShouldBroadcast`), so nothing reaches the browser.

### 6. Role / permission-conditional UI

- The whole page and every endpoint require `manageIntegrations` (workspace owner/admin). The one exception is `IntegrationTargetsController@index`, which authorizes `view` on the team; it is used by the action-item export dialog, not by this page.
- `card.connection === null` → description + connect action; otherwise details + actions.
- `connection.status`: `active` gates the test button (except for the generic webhook), People / Priorities / status sync panels and "Detect again"; `setup_required` shows the Jira site picker in place of the details; `reconnect_required` shows a destructive badge, `lastError` in the card (ci/integration-card.tsx:32-37) and, for the webhook, "Re-enable".
- `connection.access`: `write` gates People and Priorities / Priority labels; `read` shows "Upgrade to read and write" (Jira, Jira DC OAuth, Linear) or the "can only read issues" hint (GitHub).
- `card.authMethods` (Jira DC): which connect options exist; `settings.authMethod === 'pat'` switches to the token UI ("Acting as :name in Jira" warning, "Replace token", "Remove token").
- `connection.statusSync` gates the sync details; `inboundMode` + `webhookStatus` choose the mode line; `inboundHint` shows the reconnect hint or the manual webhook panel.
- `telegram.botUsername === null` disables Connect and shows "Telegram did not answer…"; `telegram.conflict` shows "The Telegram bot is used elsewhere…".
- Server-side guards the UI mirrors: `IntegrationMappingGuard` (trackers only, write access, Jira needs the `read:jira-user` scope), `ensureWritable()` for priority map and labels, `StatusSync::isOn` and `acceptsWebhooks` for tracker webhooks (409 with a translated message).

### 7. Other state worth preserving

- Status badge: "Not connected" (outline), `statusLabel` as default / secondary / destructive (ci/integration-status-badge.tsx).
- Details list always appends "Connected by" (name or "Former member") and "Last checked" (date or "Never") (ci/integration-details.tsx:29-39).
- Telegram pending-code box: instructions, command, countdown "Waiting for the command… (:time left)" (`useCountdown`, 250 ms tick) and "This code has expired. Create a new one." The "connected" detection compares `id|status|chatId|connectedBy` before and after, so a test message does not count as a new connection (telegram-integration.tsx:39-52).
- URL and secret are write-only: the webhook URL is never sent back, the dialog always starts with an empty URL, and the signing secret appears only in the connect and rotate responses.
- Webhook events panel is re-keyed on the saved events (`key={events.join(',')}`, webhook-integration.tsx:217) so local selection resets after a save.
- Deliveries panel: stale-response guards with request counters (`latestRequest`, `latestDetails`), spinner, error + Retry, "No deliveries yet.", "Redelivery" tag, and "Content not kept" vs "Content no longer kept" (older than 30 days, `PayloadRetentionDays`) when `hasContent` is false. Time column uses `lastAttemptAt ?? createdAt`. Kind labels: event name, or "Board link" / "Game link" / "Room invite" / "Results".
- Delivery dialog: loading spinner, "Could not load this delivery." (`role="alert"`), "Not sent yet.", pretty-printed JSON body, "No response body.".
- Status sync mode line: "Webhooks aren't reaching skrum; checking every :n minutes." / "Live updates (webhooks)" / "Setting up live updates…" / "Checking every :n minutes."; "Last sync: :time" uses the later of `lastPolledAt` and `lastInboundAt`.
- People badges: "Not mapped", "Account inactive", "Never assign", "Matched by email", "Set manually", "Linked via GitHub sign-in"; per-provider hint line (people-panel.tsx:65-80).
- Priority defaults shown in the "Default (:name)" option: Jira names High / Medium / Low (untranslated on purpose), Linear numbers 2 / 3 / 4 resolved to names (priorities-panel.tsx:31-41).
- Validation errors (422) are shown inline in the URL dialogs, the token dialog and the GitHub labels form; everything else goes to a toast.
- Cards carry `data-test="integration-card-{provider}"` (integration-card.tsx:23), used by the browser test suite.

---

## Slice notes

### JSON (non-Inertia) endpoints called by this slice

All under `w/{workspace}/teams/{team}/integrations` unless noted:

- POST `telegram/code`
- POST `jira-dc/token`
- POST `{provider}` (msteams, mattermost, webhook)
- PATCH `{integration}`
- DELETE `{integration}`
- POST `{integration}/test`
- POST `{integration}/detection`
- GET `{integration}/user-mappings`, POST `{integration}/user-mappings/match`, PUT and DELETE `{integration}/user-mappings/{user}`
- GET `{integration}/accounts?q=`
- GET `{integration}/priorities`
- GET `{integration}/statuses[?container=]`
- GET and POST `{integration}/webhook`
- POST `{integration}/secret`
- GET `{integration}/deliveries?page=`, GET `{integration}/deliveries/{delivery}`, POST `{integration}/deliveries/{delivery}/redelivery`
- DELETE `whiteboards/{board}` (from the team page)

Non-JSON but not an Inertia visit: GET `{provider}/connect` (plain anchor, external redirect).

### Routes in this area with no caller in this slice

- GET `…/integrations/{integration}/targets` (`teams.integrations.targets.index`): called only by `resources/js/components/action-items/export-action-item-dialog.tsx`.
- POST `…/integrations/{integration}/webhook` **without** `registered` (on-demand re-registration, the Jira Cloud path in `TrackerWebhooksController@store`): no front code sends it; the only caller sends `{registered: true}`.
- POST `teams.store` and GET/POST `teams.games.*`, GET `teams.estimates.index` belong to other pages.
- `integrations/webhooks/{source}` and `integrations/webhooks/{source}/{integration}/{token}` are inbound provider webhooks, never called by the front.

### Dead or out-of-page components

- Nothing in `components/teams/` or `components/integrations/` is unimported.
- `components/integrations/share/delivery-lines.tsx` and `share/post-link-section.tsx` are not used by either page here; they are mounted by the retro, poker and games share dialogs.
- In `lib/integrations.ts`, only `integrationErrorMessage` is used by this slice; `ShareChannels`, `hasShareChannel`, `deliveryChannelLabel`, `postLinkLabel`, `shareResultsLabel`, `recapDialogTitle` serve those share dialogs.
- `deckChoiceFromGame` (deck-fields.tsx:32) is used only by `components/poker/game-settings-dialog.tsx`.

### Surprising

- "Saved decks" and "Whiteboard templates" dialogs are shown to every viewer, and any team viewer can create a saved deck; only edit and delete are gated.
- Removing a team member and archiving a health statement have no confirmation step.
- The Jira and Linear cards mount `StatusSyncSection` themselves, while Jira DC and GitHub receive it from the page as `statusSection`. Same component, two wiring styles.
- `TestConnectionButton` reloads `providers` even when the test fails.
- `StoryPointsField` is hidden while a Jira connection is `setup_required`.
- The generic webhook's test button ignores status (the server skips `ensureActive()` for webhooks), unlike every other provider.
- `retroRequest` is the generic JSON client for integrations despite its name.
- Several presented fields are never read by the front (listed in Props).

### Hardcoded, untranslated user-facing strings

- `'OAuth'` as the "Signed in with" value (jira-data-center-integration.tsx:234).
- `'—'` placeholders (url-channel-integration.tsx:181, webhook-integration.tsx:200, webhook-deliveries-panel.tsx:210/306/309, webhook-delivery-dialog.tsx:206, jira-data-center-integration.tsx:224).
- Placeholder `"1, 2, 3, 5, 8"` (deck-fields.tsx:240, saved-decks-dialog.tsx:282).
- `PayloadExample` (webhook-events-panel.tsx:24-50) and `VerificationSnippet` (webhook-secret.tsx:23-26), English technical blocks.
- Brand names in `deliveryChannelLabel` and the Jira default priority names (intentional).
- Provider labels come from the server (`IntegrationProvider::label()`), only "Webhook" is translated.

### Could not verify

- How `IntegrationException` subclasses (`ReconnectRequired`, `ProviderUnavailable`, `ProviderRejected`, `RateLimited`, `ReadOnlyConnection`, `TelegramConflict`, `AssigneeMappingUnavailable`) render to JSON (status codes and message shape); I did not read their `render()` or the exception handler.
- The exact response shapes of `ListProviderPriorities` and `ExternalAccount::toArray()`; taken from the TS types (`ProviderPriority`, `ExternalAccount`).
- The validation internals of `MattermostWebhookUrl`, `OutgoingWebhookUrl` and the Teams URL rule (allowed hosts, private networks, http).
- `InboundModes::acceptsWebhooks` and the `auto` reachability logic behind `inboundMode`.
- What `WhiteboardsController@destroy` returns and whether it broadcasts to an open board.
- `ManageTeamHealthStatements` rules (duplicates, limits) behind `errors.statements`.
- The `OAuthConnectors` per-provider authorization URLs and scopes.
- No test or browser run was done; behaviour is read from source only.


---

<!-- part: 01-retro-board -->

# Slice 01 — Retro board core (`retros/show`, `retros/join`, `retros/session-ended`)

Paths are relative to `/Users/aritti/Projects/skrum`. `C/` = `resources/js/components/retro/`, `Ctl/` = `app/Http/Controllers/Retros/`.

---

## pages/retros/show.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `retros/{retro}` | `retros.show` | GET | `RetrosController@show` (`Ctl/RetrosController.php:21`) | `ResolveRetroParticipant` (routes/web.php:369-373: `whereUuid('retro')`, `scopeBindings()`); NO `auth` middleware — guests enter with a cookie |

`ResolveRetroParticipant` (app/Http/Middleware/ResolveRetroParticipant.php:17-40) resolves the participant via `ResolveParticipant` (app/Actions/Retros/ResolveParticipant.php): logged-in user who `can('view', $retro->team)` → `Participant::firstOrCreate(retro_id,user_id)` (so simply opening the board creates the participant); else guest cookie `retro_guest_{retroId}` = `{participantId}|{secret}` checked against `guest_secret_hash`, only when `guest_access_enabled`. No participant:
- anonymous + non-JSON → redirect to login (guest access off) or render `retros/session-ended` (guest access on);
- otherwise `401 "Your session has expired."` (no user and no guest cookie) or `403 "You no longer have access to this retrospective."`.

### 2. Props

Single prop `snapshot`, built by `App\Actions\Retros\BuildBoardSnapshot::handle($retro, $viewer)` (app/Actions/Retros/BuildBoardSnapshot.php:63-186). The same array is returned as JSON by `GET retros/{retro}/snapshot` (`RetroSnapshotsController@show`). TS type: `Snapshot` in `resources/js/lib/retro/types.ts:269-338`. Every key matches the TS type (no missing/extra key found).

```
snapshot.retro {                                  // BuildBoardSnapshot.php:91-120
  id, teamId, title, template,
  phase: 'health_check'|'icebreaker'|'writing'|'grouping'|'voting'|'discussing'|'completed',
  phases: RetroPhase[]            // Retro::phases(): all cases minus health_check/icebreaker when disabled (Retro.php:228)
  healthCheckEnabled, icebreakerEnabled, icebreakerGame (GameKind),
  isAnonymous, reactionsEnabled, cursorsEnabled, gifsEnabled,
  gifProvider: string|null        // GifCatalog::providerName() = config('services.gifs.provider') or null; TS narrows to 'giphy'|'tenor'|null
  hideVoteCounts, isLocked, presentationMode, aiSummaryEnabled,
  votesPerParticipant: int        // Retro::voteLimit(): explicit value, else min(10, topLevelCards+3) (Retro.php:80)
  votesAuto: bool                 // votes_per_participant === null
  guestAccessEnabled,
  guestUrl: string|null           // route('retros.join.show', guest_token) ONLY for the facilitator while guest access is on
  facilitatorParticipantId, timerEndsAt (ISO8601|null), highlightedCardId, completedAt
}
snapshot.viewer {                                 // :121-133
  participantId, userId (null for guests),
  canManageActionItems (facilitator || workspace manager), isWorkspaceManager,
  isReviewFacilitator (facilitator && phase != completed),
  facilitatedRetroIds: string[]   // retros of the same team this user facilitates
  isFacilitator, isGuest, canHandleSuggestions (SuggestionGuard),
  remainingVotes: int             // max(0, voteLimit - my votes)
  transferCandidates: {userId,name}[]  // facilitator only, else []; team members + workspace owners/admins, minus self
}
snapshot.columns: {id,title,description|null,color,position}[]      // PresentColumns
snapshot.cards: BoardCard[]                       // sorted by position; PresentCard + extras (:135-148)
  { id, columnId, parentCardId|null, position, isMine, hidden,
    content|null, gif {id,previewUrl,url}|null, author {id,name}|null, groupName|null,
    votes: int|null        // null unless Retro::showsVoteTotals() (discussing/completed, or voting && !hide_vote_counts)
    myVotes: int,
    reactions: {emoji,count,mine,names[]}[]   // [] when hidden; names [] on anonymous retros; sorted by count desc
    commentCount: int      // non-deleted comments, 0 when hidden
    comments: CommentThread[]   // [] when hidden; top-level + replies[]
    sentiment: 'positive'|'neutral'|'negative'|null, category: string|null   // only when LLM configured and not hidden
  }
snapshot.participants: {id,name,avatarUrl,isGuest}[]   // everyone who ever joined (PresentParticipant), not "online"
snapshot.actionItems / carriedActionItems / carriedActionItemsHasMore / exportSources / teamMembers   // sibling slice
snapshot.insights, roti {myScore,respondents}, surveys, results, healthCheck   // sibling slices
snapshot.icebreaker: GameSnapshot|null   // only in phase icebreaker; building it creates the room + the viewer's GamePlayer and expires a stale round (:308-324)
snapshot.icebreakerGames: GameOption[]   // {value,label,available,...}
snapshot.integrations, linkDeliveries     // sibling (share)
snapshot.votesCast: int|null     // total votes, only in phase voting
snapshot.votesVersion: int       // read under a shared lock together with the totals
snapshot.links { team|null, actionItems|null, workspace(slug)|null }   // all null for guests
snapshot.emojiData { baseUrl: '/emoji-data/{version}', locale }
snapshot.features { llm: bool, llmProvider: string|null }
snapshot.serverTime: 'Y-m-d\TH:i:s.v\Z' UTC
```

Card visibility rules (app/Actions/Retros/PresentCard.php:18-41): `hidden = !isMine && phase in (health_check, icebreaker, writing)`; hidden cards have `content/gif/groupName = null`; `author` is null when hidden or when anonymous and not mine; `gif` is also null when no GIF provider is available (the stored gif id is kept server-side).

Comment shape (PresentComment.php): `{id, cardId, parentCommentId|null, isMine, deleted, content|null, author|null, createdAt}`; author hidden on anonymous retros unless mine; deleted comments have `content=null, author=null`.

Type notes / mismatches:
- `BoardCard.totalVersion` is client-only (stamped by `seedTotalVersions`, board-reducer.ts:246).
- Broadcast card/comment/action-item payloads are presented with `viewer = null`: `isMine` is always false, anonymous authors are stripped, reactions have no `mine`. The reducer merges them (see §7). The TS types do not distinguish these "viewerless" shapes.
- Shared props read by this page tree: `translations`/`locale` (via `useTrans`), `locales` (`LanguageSwitcher`, guests only), `name` (title template in app.tsx). The page does not use `auth.user`; identity comes from `snapshot.viewer`.

### 3. Layout

None: `resources/js/app.tsx:58-62` returns `null` for `retros/show` (full-screen board, no sidebar). Global wrappers still apply: `TooltipProvider delayDuration={0}` and sonner `<Toaster />` (app.tsx:74-81).

### 4. User actions

All mutations go through `retroRequest()` (`resources/js/lib/retro/api.ts`): Inertia's `http` client, `Accept: application/json`, `X-Socket-ID` header (so the server's `toOthers()` skips the sender), 15 s timeout (`AbortSignal.timeout`) → `RetroRequestError(status 0,'timeout')`; error message = first validation error, else `message`. Most calls are wrapped in `ctx.run()` (use-retro-board.ts:519): on failure → 401/419 sets `sessionExpired` (banner, no toast); otherwise `toast.error(message)` then a full snapshot refetch (this is the rollback of optimistic updates).

"Editable" = `!retro.isLocked` (`ctx.isEditable`, C/board.tsx:129). Server lock = HTTP 423 "The board is closed for editing." (`RetroGuard::unlocked`).

#### Header (C/board-header.tsx)

| Action | UI element | HTTP / route | Who |
|---|---|---|---|
| Back to team | arrow `Link` (board-header.tsx:39-47), `links.team` | Inertia GET `teams.show` | members only (`links.team` null for guests) |
| Previous phase | `PhaseStepper` "Previous" (C/phase-stepper.tsx:55-64); hidden when completed or on first phase | `PUT retros/{retro}/phase` `retros.phase.update` `RetroPhasesController@update` `{phase}`; on success `ctx.refetch()` | facilitator (`viewer.isFacilitator`; server `RetroGuard::facilitator`, only neighbour phase allowed else 422) |
| Next phase / Complete | "Next" / "Complete" when next is `completed` (:84-92) | same | facilitator |
| Reopen | "Reopen" when phase `completed` → `discussing` (:93-102) | same | facilitator |
| Phase list | `<ol aria-label="Phases">` with `aria-current="step"` (:65-83) | display only, built from `retro.phases` | all |
| Start timer 1/3/5/10 min | `TimerControl` dropdown (C/timer-control.tsx:51-59) | `PUT retros/{retro}/timer` `retros.timer.update` `RetroTimersController@update` `{seconds}` (server accepts 10..7200 or null); applies `timer.set` from response | facilitator, phase != completed (board-header.tsx:64; server `RetroGuard::open`) |
| Stop timer | "Stop timer" item, disabled when no timer (:61-66) | same with `{seconds:null}` | facilitator |
| Timer display | `TimerDisplay` (C/timer-display.tsx), `role="timer"`, keyed by `timerEndsAt` | client-only: 250 ms tick, server-clock offset (`useServerOffset(serverTime)`), shows `m:ss` then "Time's up!" in destructive colour; at zero, once per timer and only if it was seen running: `toast("Time's up!")` + 880 Hz WebAudio beep (try/catch) | all |
| Votes progress | `VoteProgress` (C/vote-progress.tsx), phase voting only | display: "Votes left: n", progressbar `cast / (participants.length × votesPerParticipant)` | all |
| Carried action items | `CarriedActionItemsPanel` mounted in header actions (board.tsx:246) | SIBLING | — |
| Suggest group names (AI) | `SuggestGroupNamesButton` (C/group-name-suggestions.tsx:94-135) + disclosure "Card contents of these groups are sent to :provider." | `POST retros/{retro}/group-name-suggestions` `retros.group-name-suggestions.store` `GroupNameSuggestionsController@store` (no body; server rate-limits 5/min per participant, 20/min per retro; 404 when LLM off or `ai_summary_enabled` false) → `{suggestions:[{cardId,name}]}`; empty → toast "No new names to suggest." | anyone (incl. guests) when `features.llm && retro.aiSummaryEnabled && phase in grouping/voting/discussing && isEditable && an unnamed group exists` |
| Share board | `ShareBoardButton` (board.tsx:248) | SIBLING | — |
| Add survey | `AddSurveyButton` from surveys-column (board-header.tsx:61) | SIBLING | — |
| Facilitator menu | `FacilitatorMenu` dropdown (C/facilitator-menu.tsx): Settings… / Guest link… / Hand over facilitation… / Delete retrospective… | client-only (opens dialogs; all forced closed while `sessionExpired`) | facilitator |
| Hide/show my cursor | icon toggle button `aria-pressed` (board-header.tsx:69-87), only when `showsCursors(retro)` | client-only; persisted in localStorage `skrum.hideMyCursor` (`useLocalPreference`) | all |
| Language switcher | `LanguageSwitcher` (board-header.tsx:88) | shared component (not detailed here) | guests only (`viewer.isGuest`) |
| Lock badge | `LockBadge` "Board closed for editing" (C/lock-badge.tsx) | display | all, when `isLocked` |
| Presence strip | `PresenceStrip` (C/presence-strip.tsx): 8 avatars max + "+N", tooltip name (+ " · Guest"), `aria-label ":count online"`, each `<img data-presence-id>` (used as flying-reaction origin and by browser tests) | display | all |

#### Settings dialog (C/settings-dialog.tsx) — facilitator

One form, sends ONLY changed keys: `PATCH retros/{retro}/settings` `retros.settings.update` `RetroSettingsController@update` (204), then `ctx.refetch()` and close. Uses `retroRequest` directly (not `run`): errors are shown inline (`InputError`), a 401/419 closes the dialog and raises the session banner. No change → just closes.

| Field | Key | Client disable rule | Server rule |
|---|---|---|---|
| Title (max 120, required) | `title` | — | any phase |
| Anonymous cards | `is_anonymous` | disabled when `retro.isAnonymous && cards.length>0` (+ help text) | cannot turn off once cards, health answers or survey activity exist |
| Automatic vote limit / Votes per participant (1-20) | `votes_per_participant` (null = auto) | disabled unless phase in health_check/icebreaker/writing/grouping; auto shows "Automatic: number of cards plus 3, at most 10." | same phases, else 403 |
| Health check | `health_check_enabled` | disabled when completed or current phase is health_check | cannot disable the current phase; enabling freezes health statements |
| Icebreaker | `icebreaker_enabled` | disabled when completed or current phase is icebreaker | same |
| Icebreaker game (`IcebreakerGameSelect`, shown when icebreaker on; lists `icebreakerGames` that are `available` or currently selected) | `icebreaker_game` | disabled when completed | enum + availability rule |
| Show reactions | `reactions_enabled` | completed | open phases only |
| Show live cursors | `cursors_enabled` | completed | idem |
| Allow GIFs (only rendered when `gifProvider !== null`) | `gifs_enabled` | completed | idem |
| Hide vote counts | `hide_vote_counts` | completed | idem |
| Close for editing | `is_locked` | completed | idem |
| Presentation mode | `presentation_mode` | completed | idem |
| AI summary switch (`AiSummarySwitch`, only when `features.llm && features.llmProvider`) | `ai_summary_enabled` | completed | 422 "Not available." if LLM not configured (component itself: SIBLING) |

#### Guest link dialog (C/guest-link-dialog.tsx) — facilitator

| Action | UI | HTTP | Notes |
|---|---|---|---|
| Allow guests | checkbox (:77-85) | `PATCH retros/{retro}/settings` `{guest_access_enabled}` then refetch | |
| Copy link | read-only input (selects on focus) + "Copy" (:91-103) | client-only `navigator.clipboard.writeText(retro.guestUrl)`; toast "Link copied" / error toast | only when enabled and `guestUrl` present |
| Create a new link | button (:105-112) + warning text | `POST retros/{retro}/guest-token` `retros.guest-token.store` `RetroGuestTokensController@store` → `{guestUrl}` (response ignored; refetch) | server rotates token AND nulls every guest's `guest_secret_hash` (all guests signed out) |
| Post link to chat | `<BoardPostLink />` (:121) | SIBLING | |

#### Hand over (C/handover-dialog.tsx) — facilitator

Select among `viewer.transferCandidates` ("No one else can facilitate this retrospective yet." when empty) → `PUT retros/{retro}/facilitator` `retros.facilitator.update` `RetroFacilitatorsController@update` `{user_id}` (204; target must `can('view', team)`; creates their participant if needed) → refetch, close. After refetch the former facilitator's `isFacilitator` is false and the menu disappears.

#### Delete retro (C/delete-retro-dialog.tsx) — facilitator

Confirm dialog, warns "This also deletes N open action item(s)" (count of `actionItems` with status open) → `DELETE retros/{retro}` `retros.destroy` `RetrosController@destroy` (204) → `router.visit(links.team ?? dashboard().url)`. Others receive `retro.deleted`.

#### Columns

| Action | UI | HTTP | Who / when |
|---|---|---|---|
| Add column | `AddColumn` form at the end of the board (C/add-column.tsx): title (max 100) + colour radiogroup (green/red/blue/amber/purple/slate, default green) | `POST retros/{retro}/columns` `retros.columns.store` `ColumnsController@store` `{title,color}` (server also accepts `description`, never sent) → `{columns}` → `columns.set` | facilitator, phase in health_check/icebreaker/writing (`ColumnEditPhases`, column-header.tsx:39; board.tsx:331-334) |
| Rename | column menu "Rename" → inline input (Enter/blur saves, Escape cancels, max 100) (column-header.tsx:102-121,170-188) | `PATCH retros/{retro}/columns/{column}` `retros.columns.update` `{title}` | same; disabled when the column has any card (server 422 "This column still has cards.") |
| Edit description | menu → dialog with textarea (max 200); empty → null (:123-137,328-366) | same route `{description}` | same; allowed even with cards |
| Recolour | 6 `menuitemradio` swatches in the menu (:241-264) | same route `{color}` | disabled when column has cards |
| Move left / right | menu items (:266-277) | `PUT retros/{retro}/column-order` `retros.columns.order.update` `ColumnOrdersController@update` `{column_ids:[all ids]}` | same; disabled at edges |
| Delete column | menu → confirm dialog "Delete the column :title?" (:279-326) | `DELETE retros/{retro}/columns/{column}` `retros.columns.destroy` | only empty columns; helper text "Only empty columns can be renamed, recoloured or deleted." |
| Column description tooltip | focusable 2-line clamp + tooltip (:192-206) | display | all |
| Card count | number next to title (top-level cards) | display | all |
| Sort by votes | toggle `aria-pressed`, `data-test="retro-sort-by-votes"`, default ON, per column, not persisted (C/retro-column.tsx:28-36,88-102) | client-only (`sortByVotes`: votes desc then position) | all, phases discussing/completed |

All column responses return the full `{columns}` list (no optimistic update; `busy` guard).

#### Cards

| Action | UI | HTTP | Who / when |
|---|---|---|---|
| Compose card | `CardComposer` under each column (C/card-composer.tsx): textarea max 1000, Enter submits, Shift+Enter newline, optional GIF preview with remove (X) | `POST retros/{retro}/cards` `retros.cards.store` `CardsController@store` `{column_id, content|null, gif_id|null}` → `{card}` → `cards.upsert` | everyone, phase writing && editable (retro-column.tsx:121) |
| Attach GIF | "GIF" button → `GifPicker` → `GifSearchDialog` (resources/js/components/gifs/gif-search-dialog.tsx): search input debounced 300 ms (empty query = trending), 3-col grid, click picks `{id,previewUrl}` and closes; errors `role=alert`: 429 → "Too many searches, wait a moment.", other → "GIF search is unavailable."; empty → "No GIFs found."; footer "Powered by GIPHY/Tenor" | `GET retros/{retro}/gifs?q=` `retros.gifs.index` `RetroGifsController@index` → `{gifs:[{id,previewUrl,width,height}]}` (server: 20 searches/min per participant; phases writing/grouping; unlocked; gifs enabled) | when `gifProvider !== null && gifsEnabled && isEditable` |
| Edit card | pencil → `CardEditor` (C/card-editor.tsx): textarea, GIF add/remove, Cancel/Save | `PATCH retros/{retro}/cards/{card}` `retros.cards.update` `{content|null, gif_id?}` (gif only sent if changed) → `{card}` | author only, phases writing/grouping, editable (`canChange`, retro-card.tsx:36-39; server `RetroGuard::author`) |
| Delete card | trash (retro-card.tsx:216-225), no confirm, in-flight guard | `DELETE retros/{retro}/cards/{card}` `retros.cards.destroy` (204) → local `card.remove` with `ungroupedCards: []` then `ctx.refetch()` (the 204 carries no payload, children become top-level server-side) | author, writing/grouping |
| Reorder / move card | DnD in writing: `SortableCard` (C/dnd.tsx:88) inside `SortableContext` per column + `ColumnDropZone`; pointer (6 px activation) and keyboard sensors (`sortableKeyboardCoordinates`) | optimistic `card.place` (dispatch) then `PUT retros/{retro}/cards/{card}/position` `retros.cards.position.update` `CardPositionsController@update` `{column_id,index}` → `{cards}` → `cards.upsert`; failure → toast + refetch | writing: only own cards draggable (`disabled={!isEditable || !card.isMine}`; server enforces author in writing). In grouping any card may be moved to a column by anyone |
| Group cards | DnD in grouping: `GroupableCard` (draggable + droppable; ring on hover). Dropping card on another card (board.tsx:154-174); hint "Drag cards onto each other to group them." | `PUT retros/{retro}/cards/{card}/group` `retros.cards.group.update` `CardGroupsController@update` `{parent_card_id}` → `{cards}` (not optimistic) | everyone, grouping && editable |
| Move in grouping | dropping a card on a column zone in grouping | position route as above | everyone |
| Ungroup | icon button on a child card (retro-card.tsx:192-204) | `DELETE retros/{retro}/cards/{card}/group` `retros.cards.group.destroy` → `{cards}` | everyone, grouping && editable |
| Name / rename group | `GroupName` (C/group-name.tsx): button "Name this group" / current name + pencil → inline input (max 60, Enter (not while composing)/blur saves, Escape cancels) | optimistic `card.groupName`, then `PUT retros/{retro}/cards/{card}/group-name` `retros.cards.group-name.update` `{name}`; empty name → `DELETE …/group-name` `retros.cards.group-name.destroy` → `{cardId,groupName}` | everyone, phases grouping/voting/discussing && editable (`NamingPhases`); read-only text otherwise; only lead cards with children |
| Accept AI suggested name | "Use this name" (group-name-suggestions.tsx:184-192) | `PUT …/group-name {name}` then removes the local suggestion | same as naming |
| Edit AI suggested name | "Edit this name" (:193-204) | client-only: dismisses suggestion and opens the inline editor prefilled | same |
| Open GIF full size | click GIF thumbnail → dialog (C/card-gif.tsx) | client-only | all |
| Vote + / − | `VoteControls` (C/vote-controls.tsx), top-level cards only | optimistic `votes.tally` (dispatch) then `POST retros/{retro}/cards/{card}/votes` `retros.cards.votes.store` / `DELETE …/votes` `retros.cards.votes.destroy` → `{cardId,myVotes,remainingVotes,votesCast,votesVersion,total|null}` → `votes.tally` + `votes.cast` | everyone, voting; + disabled when `remainingVotes===0`, − when `myVotes===0`, both when locked/busy |
| Vote total badge | retro-card.tsx:159-174 | display; in voting only when `card.votes !== null` (i.e. counts not hidden); always in discussing/completed | all |
| Discuss (highlight) | "Discuss" toggle `aria-pressed` (retro-card.tsx:175-191) | `PUT retros/{retro}/highlight` `retros.highlight.update` `RetroHighlightsController@update` `{card_id|null}` → `{highlightedCardId}` → `highlight.set` | facilitator, phase discussing, top-level cards |
| Stop presenting / close overlay | `PresentationOverlay` dialog (C/presentation-overlay.tsx): "Stop presenting" button or closing the dialog | facilitator: `PUT …/highlight {card_id:null}`; participant: client-only dismiss (re-opens when the highlighted card changes) | overlay opens for everyone when `presentationMode && phase==='discussing' && highlighted card not hidden` |
| React to card | `CardReactions` → `ReactionChips` (C/reaction-chips.tsx): chip per emoji (`aria-pressed`, tooltip with names), "+" opens `EmojiPicker` | optimistic `reactions.set` then `PUT retros/{retro}/cards/{card}/reactions` `retros.cards.reactions.update` / `DELETE …/reactions` `retros.cards.reactions.destroy` body `{emoji}` → `{cardId,reactions}` | everyone when `reactionsEnabled && isEditable && phase in grouping/voting/discussing`; chips are read-only otherwise; nothing rendered if reactions disabled or card hidden |
| Emoji picker | `EmojiPicker` (C/emoji-picker.tsx): dropdown with 6 quick emoji (👍 ❤️ 👏 🎉 🤔 👎) + "More emoji…" → dialog with frimousse (search, categories, loading/empty states, "Emoji list unavailable" alert) | client-only; emoji data fetched from `snapshot.emojiData.baseUrl` (`GET emoji-data/{version}/{locale}/{file}`, route `emoji-data.show`, web.php:173) | — |
| Toggle comments | `CardComments` button "Comments (n)" `aria-expanded`, unread dot (C/card-comments.tsx:34-53) | client-only; opening marks the card read (localStorage) | hidden for hidden cards and in writing when count is 0 |
| Add comment / reply | `CommentThreadList` (C/comment-thread.tsx): textarea max 500, Enter submits, Shift+Enter newline; "Reply" opens reply form and expands replies | `POST retros/{retro}/cards/{card}/comments` `retros.cards.comments.store` `{content,parentCommentId}` → `{comment}` → `comment.upsert` | everyone, phases grouping/voting/discussing && editable (`CommentPhases`) |
| Edit comment | pencil → inline form | `PATCH retros/{retro}/comments/{comment}` `retros.comments.update` `{content}` | author only |
| Delete comment | trash, no confirm | `DELETE retros/{retro}/comments/{comment}` `retros.comments.destroy` (204); local `comment.remove` (soft when top-level with replies; also hard-removes a soft-deleted parent whose last reply was removed) | author or facilitator |
| Expand replies | "1 reply"/":count replies" link `aria-expanded` | client-only | all |

Sibling mounts inside the card: `CardInsight` (sentiment icon + category badge; C/card-insight.tsx, shared with insights) — display only.

#### Board body / misc

| Action | UI | HTTP | Who |
|---|---|---|---|
| Completed tabs | `CompletedTabs` + `ResultsView` (board.tsx:255-270); resets to "results" on every phase change | SIBLING (the "board" tab shows the read-only columns) | all |
| Health check panel | `PhasePanel` → `HealthCheckPanel` in phase health_check (C/phase-panel.tsx) | SIBLING | |
| Surveys column | `SurveysColumn` first item in `<main>` (board.tsx:316) | SIBLING | |
| Suggestions + action items panels | phase discussing only (board.tsx:349-354) | SIBLING | |
| Icebreaker stage | phase icebreaker replaces the columns (board.tsx:271-272) — see below | | |
| Send flying reaction | fixed bottom toolbar `role="toolbar"` "Reactions": 6 quick emoji + picker (resources/js/components/realtime/flying-reactions.tsx:106-135) | whisper only (no HTTP) | everyone when `reactionsEnabled && phase !== 'completed'` and the presence channel is joined |
| Live cursors | `LiveCursorLayer` over `<main>` (and over the icebreaker stage) | whisper only | when `cursorsEnabled && phase not in voting/completed`, unless "hide my cursor" |
| Reload after session expiry | `SessionExpiredBanner` "Reload" (`window.location.reload()`) | client-only | all |
| Back to team (ended) | `BoardEnded` (C/board-ended.tsx) | Inertia link | members |

Keyboard DnD: Space/Enter pick up, arrows move, Space/Enter drop, Escape cancel; translated screen-reader instructions and live announcements (`useDragAccessibility`, dnd.tsx:31-86; hidden cards announced as "a hidden card", GIF-only cards as "GIF"). `dragIsolation` (dnd.tsx:131) stops key/pointer propagation from interactive content inside cards (also portaled dialogs/menus) so typing never starts a drag. `DragOverlay` shows `CardPreview` at the dragged card's measured width.

#### Icebreaker embedding (C/icebreaker-stage.tsx, C/icebreaker-game.tsx)

- `IcebreakerStage`: spinner while `board.icebreaker === null`; else `<IcebreakerGame key={room.id} snapshot={board.icebreaker}>` + its own `LiveCursorLayer`.
- `IcebreakerGame` runs `useGameRoom(snapshot, { subscribe: false })`: the game reducer is reused but it does NOT open `presence-game.{id}` (the server refuses that channel for icebreaker rooms, BroadcastAuthorizationsController.php:186). Game events arrive on `presence-retro.{id}`; `useRetroBoard.subscribeGameEvents` fans them out to `room.handleEvent`.
- It builds a `RoomContextValue` from the room state but with the board's `online`, `presence` (strokes/cursors whispers share the retro channel) and `sessionExpired || room.sessionExpired`.
- Board timer is the game timer: `withBoardTimer` overrides `room.timerEndsAt` with `retro.timerEndsAt` (the facilitator's `TimerControl` drives it; server `ScheduleIcebreakerExpiry`).
- `useBoardSnapshotRefetch`: when the board snapshot's `icebreaker` object changes, it calls the room's own buffered `refetch()` instead of replacing state.
- `useUnknownPlayerRefetch`: online members (or the round leader) without a game player trigger a room refetch after 1.5 s, max 3 attempts per id.
- Header: "Icebreaker" title, `GameSwitcher` for the host (`room.isHost`) or a badge with the game label, `HistoryDrawer`; body `GamePanel` (all in `resources/js/components/games/*` — other agent).
- `IcebreakerGameSelect` is also used by `components/teams/new-retro-dialog.tsx`.

### 5. Realtime

Echo is configured in `resources/js/app.tsx:13-39` (Reverb, ws/wss only, custom authorizer POSTing `{socket_id, channel_name}` to `POST broadcasting/auth` `broadcasting.auth` `BroadcastAuthorizationsController@store`). Hook: `resources/js/hooks/use-retro-channel.ts`, consumed by `resources/js/hooks/use-retro-board.ts`; state in `resources/js/lib/retro/board-reducer.ts`. If Echo is not configured the hook is a no-op (board still works through HTTP responses).

Channels (use-retro-channel.ts:157-230):

| Channel | Type | Who | Auth (BroadcastAuthorizationsController.php) |
|---|---|---|---|
| `presence-retro.{retroId}` (`echo().join('retro.{id}')`) | presence | every participant | :73-101 `ResolveParticipant` must return a participant; member info `{id: participantId, name, avatarUrl, isGuest}` |
| `private-participant.{participantId}` | private | the participant only | :218-236 resolved participant id must equal the channel id |
| `private-retro-members.{retroId}` | private | non-guests only (`membersOnly = !viewer.isGuest`) | :241-259 participant and `!isGuest()` |

Subscriptions are torn down when `status !== 'active'` (board ended/deleted) and on unmount (`echo().leave`).

Presence: `.here` → `online` list + schedule resync; `.joining` → add/replace + if the member is not in `board.participants` → full refetch (use-retro-board.ts:361-372); `.leaving` → remove. `online` feeds the presence strip, cursor/reaction rosters, cursor labels, icebreaker.

Resync: `.here`, `.subscribed` of both private channels and any channel `.error` schedule ONE coalesced refetch after 250 ms (`ResyncCoalesceMs`) — i.e. a full snapshot refetch on first connect and on every reconnect. Connection status via `useSafeConnectionStatus` (SSR-safe `useSyncExternalStore`): `connected`; `reconnecting = status==='failed' || (wasConnected && !connected)` → `ConnectionBanner` "Reconnecting…" (`role=status`). Root div carries `data-realtime="connecting|connected"` (`realtimeState`: connected AND presence list non-empty) — used by browser tests.

All server events extend `App\Events\Retros\RetroBroadcastEvent` (`ShouldBroadcastNow`, after commit, sent with `sendToOthers()` = `broadcast()->toOthers()` inside `rescue`, app/Events/Concerns/SendsToOthers.php) — the acting socket never receives its own event and must apply the HTTP response.

#### Events on `presence-retro.{id}`

| `.event` | Class (app/Events/Retros) | Payload | Client handling (use-retro-board.ts:159-357 → reducer) |
|---|---|---|---|
| `card.created` | CardCreated | `{card}` (viewerless) | `cards.upsert` |
| `card.updated` | CardUpdated | `{card}` | `cards.upsert` |
| `card.deleted` | CardDeleted | `{cardId, ungroupedCards[]}` | `card.remove` (removes card, upserts former children) |
| `cards.moved` | CardsMoved | `{cards[]}` | `cards.upsert` |
| `card.grouped` | CardGrouped | `{cards[]}` | `cards.upsert` |
| `card.ungrouped` | CardUngrouped | `{cards[]}` | `cards.upsert` |
| `card.group-named` | CardGroupNamed | `{cardId, groupName|null}` (also sent with null when a group empties after a delete) | `card.groupName` |
| `vote.cast` / `vote.retracted` | VoteCast / VoteRetracted | `{votesCast, votesVersion, cardId?, total?}` (card total omitted when vote counts are hidden) | `votes.cast` (version-guarded) |
| `card.reactions.changed` | CardReactionsChanged | `{cardId, reactions:[{emoji,count,names}]}` | `reactions.set` (keeps own `mine`) |
| `comment.created` / `comment.updated` | CommentCreated / CommentUpdated | `{comment}` (viewerless) | `comment.upsert` |
| `comment.deleted` | CommentDeleted | `{cardId, commentId, soft}` | `comment.remove` |
| `timer.changed` | TimerChanged | `{timerEndsAt|null}` | `timer.set` |
| `card.highlighted` | CardHighlighted | `{cardId|null}` | `highlight.set` (+ board scrolls the card into view, board.tsx:96-106; overlay re-opens) |
| `columns.changed` | ColumnsChanged | `{columns[]}` | `columns.set` (sorted by position) |
| `phase.changed` | PhaseChanged | `{phase}` (payload ignored) | immediate full refetch |
| `settings.changed` | RetroSettingsChanged | `{}` | immediate full refetch (also sent on guest-token rotation, facilitator handover, team health statements change) |
| `retro.deleted` | RetroDeleted | `{}` | `end('deleted')` → `BoardEnded` |
| `action-item.saved` | ActionItemSaved | `{actionItem}` | `actionItem.upsert` |
| `action-item.deleted` | ActionItemDeleted | `{actionItemId}` | `actionItem.remove` |
| `action-item.comments.changed` | ActionItemCommentsChanged | `{actionItemId, commentCount}` | `actionItem.comments` with `refresh:true` (bumps client `commentsRevision`) |
| `health.answered` | HealthAnswered | `{statements:[{key,count,answeredBy[]}]}` | `health.progress` |
| `survey.changed` | SurveyChanged | `{surveyId, version, responseCount}` | `survey.counts` + `surveyRefetcher.schedule(id)` when `needsSurveyRefetch(local, version)` (lib/retro/survey-api.ts — sibling) |
| `survey.deleted` | SurveyDeleted | `{surveyId}` | refetcher `invalidate` + `survey.remove` |
| `survey.discussion.changed` | SurveyDiscussionChanged | `{surveyId, commentCount}` | `survey.counts` + refetch that survey if its `resultsVisible` |
| `roti.changed` | RotiChanged | `{respondents}` | `roti.set`; in phase completed also debounced refetch |
| `insights.changed` | InsightsChanged | `{}` | debounced full refetch (1 s, `scheduleRefetch`) |
| `results.changed` | ResultsChanged | `{}` | debounced full refetch (1 s) |
| `game.*` (16 names, `GameEvents` in hooks/use-game-channel.ts:8-25) | app/Events/Games/* via `GameBroadcastEvent` (icebreaker rooms broadcast on `retro.{retro_id}`, GameRoom.php:159) | per game event | forwarded untouched to `subscribeGameEvents` listeners (the icebreaker panel) |

#### Events on `private-participant.{id}`

| `.event` | Class | Payload | Client handling |
|---|---|---|---|
| `own-card.saved` | OwnCardSaved | `{card}` presented for the author | `cards.upsert` (lets the author's other tabs see their own hidden card with content) |
| `own-comment.saved` | OwnCommentSaved | `{comment}` (isMine true, author kept) | `comment.upsert` |
| `own-survey-comment.saved` | OwnSurveyCommentSaved | `{comment}` (has `surveyId`) | `surveyRefetcher.schedule(comment.surveyId)` |
| `comment.notification` | CommentNotification | `{cardId? | surveyId?, commentId, threadId, excerpt (≤79 chars + …), authorName?}` (authorName omitted on anonymous retros) | marks card unread (`notifications.notify`) + toast: "New reply in a thread you follow" (threadId ≠ commentId) / "New comment on your survey" / "New comment on your card", description `author: excerpt` |

Recipients of card comment notifications (CardCommentsController.php:104-125): the card author + everyone in the thread, minus the commenter.

#### Events on `private-retro-members.{id}` (members only)

| `.event` | Class | Payload | Client handling |
|---|---|---|---|
| `carried-action-item.saved` | CarriedActionItemSaved | `{actionItem}` | `carriedActionItem.upsert` (re-sorted with `compareActionItems`) |
| `carried-action-item.removed` | CarriedActionItemRemoved | `{actionItemId}` | `carriedActionItem.remove` |
| `carried-action-item.comments.changed` | CarriedActionItemCommentsChanged | `{actionItemId, commentCount}` | `actionItem.comments` refresh:true (updates both lists) |
| `action-item.external-links.changed` | ActionItemExternalLinksChanged | `{actionItemId, externalLinks[]}` | `actionItem.externalLinks` (both lists) |

Cross-check: every class in `app/Events/Retros/**` (37 concrete) is listened to; no listened name lacks a class. `App\Events\RetroCompleted` is a domain event, not broadcast.

#### Whispers (client events on the presence channel)

Transport: `resources/js/lib/realtime/whisper-transport.ts` — `channel.whisper(event, msg)` / `channel.listen('.client-{event}')`; the sender id is read from Reverb's `metadata.user_id` (config/reverb.php:90 `accept_client_events_from => 'members'`), never from the payload; messages from senders not in the current `online` roster are dropped. `channelKey(presence)` is used as React key so a new channel object rebuilds the transport.

| Whisper | File | Payload | Behaviour |
|---|---|---|---|
| `client-cursor` | resources/js/components/realtime/live-cursors.tsx (wrapper C/live-cursor-layer.tsx) | `live-cursors` library messages (`moveMessage(selfId, x, y, {p: pointerType})`, `leaveMessage(selfId)`), coordinates normalised to the container (`elementSpace`) | mouse tracked by the library; touch/pen sent manually while pressed, throttled 40 ms, leave on pointerup/cancel; remote cursors removed when the sender leaves presence; label = member name, or "Participant" on anonymous retros; touch/pen rendered as a dot; `setEnabled(!hidden)` for "hide my cursor"; disabled in voting/completed (would reveal who votes) |
| `client-reaction` | resources/js/components/realtime/flying-reactions.tsx (wrapper C/flying-reactions.tsx) | `live-reactions` library message with emoji in field `e` | receive filter: sender in roster, `isSingleEmoji(e)` (mirror of `App\Rules\SingleEmoji`, ≤64 bytes), token bucket per sender (burst 5, 2/s); emoji rises from the sender's avatar (`[data-presence-id]`), or near the centre and unlabeled on anonymous retros |
| game strokes etc. | games components | — | other agent; they use `board.presence` |

### 6. Role / permission / phase-conditional UI

| Flag | Drives |
|---|---|
| `viewer.isFacilitator` (server: `Retro::isFacilitator` = `facilitator_participant_id === participant.id`, `RetroGuard::facilitator` → 403 "Only the facilitator can do this.") | phase buttons, timer control, facilitator menu (settings, guest link, handover, delete), add column + column menu, "Discuss" highlight, closing the presentation for everyone, deleting anyone's comment; `guestUrl` and `transferCandidates` only delivered to the facilitator. A guest can never be facilitator via handover (requires a user). |
| `viewer.isGuest` | language switcher shown; no back link (`links.* = null`); no `retro-members` channel; `carriedActionItems`/`exportSources` empty |
| `card.isMine` | drag in writing, edit, delete, "You" badge, unread-comment recipient |
| `comment.isMine` | edit; delete (or facilitator) |
| `retro.isLocked` (`isEditable`) | disables composer, DnD, edit/delete, vote, reactions, comments, group naming, AI name button, GIF; lock badge |
| `retro.isAnonymous` | authors hidden server-side; cursor labels "Participant"; flying reactions unlabeled and centred; comment author "Anonymous" |
| `retro.reactionsEnabled` | card reaction chips + flying reactions bar |
| `retro.cursorsEnabled` | cursor layer + hide-cursor toggle |
| `retro.gifsEnabled && gifProvider` | GIF buttons; settings checkbox only when a provider exists |
| `retro.hideVoteCounts` | `card.votes` null during voting → badge hidden |
| `retro.presentationMode` | overlay on highlighted card |
| `features.llm`, `retro.aiSummaryEnabled` | AI group-name button, AI summary switch |
| `status` (`active|ended|deleted`) | whole board replaced by `BoardEnded` |

Phase matrix (client; server guards in brackets):

| Phase | Board area | Cards |
|---|---|---|
| health_check | `HealthCheckPanel` above columns; column editing (facilitator) | others' cards hidden ("Hidden until writing ends"); no composer |
| icebreaker | `IcebreakerStage` replaces columns entirely (so add-column UI is not reachable although `ColumnEditPhases` includes it) | — |
| writing | composer; sortable own cards; column editing | others hidden; edit/delete own; comments button only if count > 0 |
| grouping | group/ungroup/move DnD by anyone; group naming; AI names | edit/delete own; reactions; comments |
| voting | vote controls, `VoteProgress`; no cursors | reactions, comments, naming |
| discussing | highlight/presentation; sort by votes; `SuggestionsPanel` + `ActionItemsPanel`; totals shown | reactions, comments, naming |
| completed | tabs Results/Board; timer control hidden; no flying reactions/cursors; read-only cards with totals | — |

### 7. Other state worth preserving

- **Reducer** `boardReducer` (board-reducer.ts:367): actions `replace`, `cards.upsert`, `card.remove`, `card.place`, `card.groupName`, `columns.set`, `votes.cast`, `votes.tally`, `timer.set`, `highlight.set`, `reactions.set`, `comment.upsert`, `comment.remove`, `actionItem.*`, `carriedActionItem.*`, `roti.set`, `health.progress`, `health.answer`, `survey.upsert|remove|counts`, `insights.suggestion`.
- **Viewerless merge** (`upsertCards`, :106-139): when a broadcast payload (`isMine:false`) hits a card known as mine, keep `isMine:true, hidden:false`, and fall back to the existing `content/gif/author`, and existing `groupName` if the payload is hidden. New cards default `votes:null, myVotes:0, reactions:[], comments:[]…`. Same idea for comments (`mergeComment`) and action items (`upsertActionItem`).
- **Vote ordering**: `votesVersion` is global per retro; `votes.cast` ignores stale versions for `votesCast`, and per-card totals are guarded by `card.totalVersion` (`applyCardTotal`); `votes.tally` with an older version is ignored; optimistic tally has no version. `replace` re-seeds `totalVersion`.
- **Refetch buffering** (use-retro-board.ts:57-131): while a snapshot request is in flight, `apply()` buffers actions and replays them after `replace`, so events newer than the snapshot are not lost; only the latest refetch wins (`latestRefetch` counter). `dispatch` (unbuffered) is used for optimistic updates. Refetch errors: 401/419 → `sessionExpired`; 404 → status `deleted`; 403 → status `ended`.
- **Session expired**: banner `role=alert` + the whole board wrapper gets `inert`; facilitator dialogs and column dialogs force-close.
- **BoardEnded** texts: "This retrospective has been deleted." / "Your access to this retrospective has ended." (e.g. guest link rotated → next refetch answers 403).
- **Card editor safety** (card-editor.tsx:43-80): if the phase changes (or the editor unmounts while the card still exists) with unsaved text → toast "The phase changed before your edit was saved."; `hasActiveCard` reads the latest board to tell why the editor is unmounting.
- **Unread comments** (`use-comment-notifications.ts`): per-retro localStorage `skrum.readComments.{retroId}` = `{cardId: newestCommentCreatedAt}`; a card is unread if the viewer is a recipient (card author or has commented) and there is a newer non-own, non-deleted comment, or a live notification arrived; opening the thread marks read. Survives reloads.
- **Local preferences**: `skrum.hideMyCursor` (boolean), `skrum.readComments.{retroId}`.
- **Highlight**: `scrollIntoView({behavior:'smooth', block:'center', inline:'center'})` on `#card-{id}`; ring on the highlighted card; leaving discussing clears the highlight server-side; completing clears the timer.
- **Empty states**: "No columns yet."; handover "No one else can facilitate…"; GIF "No GIFs found."; emoji "No emoji found."/"Loading…".
- **Toasts**: mutation errors (via `run`), "Time's up!", "Link copied", "No new names to suggest.", comment notifications, unsaved-edit warning.
- **A11y**: `role=timer`, `role=progressbar` with aria values, `role=status`/`alert` banners, `aria-current=step`, `aria-pressed` toggles, radiogroup/menuitemradio colour pickers, sr-only "Your votes: n", presence `role=group`, reactions `role=toolbar`, tabpanel wiring for completed tabs, DnD announcements.
- **Test hooks**: `data-test="retro-column-{id}"`, `data-test="retro-card-handle-{id}"`, `data-test="retro-sort-by-votes"`, `data-realtime`, `data-presence-id`, `id="card-{id}"` (tests/Browser/** rely on them).
- **Head title** = `snapshot.retro.title` from the INITIAL prop (not updated after a live rename; the `<h1>` is).
- Children of a group render nested inside the lead card (dashed, indented), without vote controls; group name hidden when the lead is hidden.

---

## pages/retros/join.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `join/{guestToken}` | `retros.join.show` | GET | `RetroJoinsController@show` (app/Http/Controllers/RetroJoinsController.php:27, invalid: :71) | none (public) |
| `join/{guestToken}` | `retros.join.store` | POST | `RetroJoinsController@store` | `throttle:10,1` |

### 2. Props

| Case | Props | Notes |
|---|---|---|
| Valid link | `isInvalid: false`, `guestToken: string`, `retroTitle: string`, `suggestedName: string|null` (logged-in user's name) | :27-32 |
| Unknown token or guest access disabled | `isInvalid: true` only, HTTP status **404** | :69-74 |

Matches the TS union (join.tsx:10-17). If the visitor already resolves to a participant (team member, or valid guest cookie) both GET and POST redirect to `retros.show`.

### 3. Layout

`AuthLayout` (app.tsx:52-57).

### 4. User actions

| Action | UI | HTTP | Who |
|---|---|---|---|
| Join as guest | Inertia `<Form {...RetroJoinsController.store.form(guestToken)}>` with `name` input (required, maxLength 50, autofocus, default `suggestedName`), `InputError` for `errors.name`, "Join" button disabled while processing (join.tsx:44-69) | `POST join/{guestToken}` → validates `name` required/string/max:50, creates a guest participant, sets cookie `retro_guest_{retroId}` (`{participantId}|{secret}`, 30 days) and redirects to `retros.show` | anyone with the link (logged-in non-members too) |

### 5. Realtime — none.

### 6. Conditional UI

`isInvalid` → heading "Join a retrospective" + "This guest link is no longer valid." (no form, no link).

### 7. Other

Throttle 10/min on POST (429 handling is whatever Inertia does by default — no custom UI).

---

## pages/retros/session-ended.tsx

### 1. Routes (4 render sites, all in middleware, no dedicated route)

All share the same condition: resolver returned null AND `$request->user() === null` AND `!$request->expectsJson()`, AND the resource accepts guests; otherwise `redirect()->guest(route('login'))`. Before rendering, each calls `redirect()->setIntendedUrl($request->fullUrl())` so logging in returns to the board.

| Middleware (file:line) | Routes guarded | Extra condition to render (else redirect to login) |
|---|---|---|
| `ResolveRetroParticipant` (app/Http/Middleware/ResolveRetroParticipant.php:54) | `retros/{retro}/**` (web.php:369) | `$retro->guest_access_enabled` |
| `ResolvePokerPlayer` (app/Http/Middleware/ResolvePokerPlayer.php:54) | `poker/{game}/**` (web.php:455) | `$game->guest_access_enabled` |
| `ResolveGamePlayer` (app/Http/Middleware/ResolveGamePlayer.php:68) | `games/{room}/**` (web.php:519) | room is NOT an icebreaker AND `$room->access === GameRoomAccess::Link` |
| `ResolveWhiteboardMember` (app/Http/Middleware/ResolveWhiteboardMember.php:54) | `whiteboards/{board}/**` (web.php:496) | `$board->guest_access_enabled` |

For JSON requests the same middlewares answer 401 "Your session has expired." (no user, no guest cookie) or 403 "You no longer have access to this …".

### 2. Props — none (only shared props). Page component takes no props.

### 3. Layout — `AuthLayout` (app.tsx:52-57).

### 4. User actions

| Action | UI | HTTP | Who |
|---|---|---|---|
| Log in | `Button asChild` → `<Link href={login()}>` (session-ended.tsx:20-22) | GET `login` (then redirected to the intended URL) | anonymous |

### 5. Realtime — none.

### 6/7. Texts: title "Your session has ended.", description "Guests: ask the facilitator for the guest link." The page is retro-named but generic for poker/games/whiteboards.

---

## Slice notes

**JSON (non-Inertia) endpoints called in this slice** (all under `retros/{retro}`, via `retroRequest`): `GET snapshot`; `PUT phase`; `PUT timer`; `PUT highlight`; `PATCH settings`; `POST guest-token`; `PUT facilitator`; `DELETE /` (retro); `POST columns`; `PATCH|DELETE columns/{column}`; `PUT column-order`; `POST cards`; `PATCH|DELETE cards/{card}`; `GET gifs?q=`; `PUT cards/{card}/position`; `PUT|DELETE cards/{card}/group`; `PUT|DELETE cards/{card}/group-name`; `POST group-name-suggestions`; `POST|DELETE cards/{card}/votes`; `PUT|DELETE cards/{card}/reactions`; `POST cards/{card}/comments`; `PATCH|DELETE comments/{comment}`. Plus `POST broadcasting/auth` (Echo authorizer), `GET emoji-data/{version}/{locale}/{file}` (frimousse), `GET gifs/{gif}?size=preview|full` (`gifs.show`, image URLs in card payloads).

**Routes in this area with no front caller**: none found — every retro-core route listed above is imported through Wayfinder. Unused server capabilities: `columns.store` accepts `description` (the add-column form never sends it); `group-name-suggestions.store` accepts `cardIds[]` (front always sends an empty body = "all unnamed groups").

**Dead code**: none found in scope; every component/hook in the slice is imported. Shared outside the retro: `ConnectionBanner`, `SessionExpiredBanner`, `PresenceStrip` (poker, whiteboard, games), `EmojiPicker` (games `clue-editor`, uses `useOptionalBoard`), `IcebreakerGameSelect` (teams `new-retro-dialog`), `useSafeConnectionStatus` (use-game-channel), `RetroRequestError`/`retroRequest` (gif dialog and other areas), `CommentThreadList` + `ReactionChips` (survey-discussion), `CardInsight`/`SentimentIcon` (insights). `PresenceStrip.badgeFor` prop is unused by the retro board.

**Surprises**
- Opening the board has side effects: creates the participant (members) and, in the icebreaker phase, the game room + the viewer's game player — on the Inertia GET and on every snapshot refetch.
- The sender never gets its own broadcast (`toOthers` + `X-Socket-ID`); every mutation must apply its HTTP response. Card delete returns 204, so the client removes locally then refetches the whole snapshot.
- `phase.changed` / `settings.changed` carry no usable data: both trigger a full refetch; many other paths also refetch (run() errors, reconnect, unknown member joining, handover, guest link changes).
- The board never polls; resync is purely event/reconnect driven with a 250 ms coalesce and a 1 s debounce for results/insights bursts.
- Timer menu offers only 1/3/5/10 minutes although the API takes any 10–7200 s.
- During the icebreaker phase the columns (and thus column editing/AddColumn) are not rendered even though the phase is allowed for column edits.
- `VoteProgress` denominator uses `participants.length` (everyone who ever joined, including guests who left), and with the automatic limit `votesPerParticipant` depends on the number of top-level cards.
- In grouping, anyone can move or group anyone's cards; only editing/deleting is author-bound.
- `Head` title is not updated after a live title change.
- Hardcoded (untranslated) user-facing strings: brand names "GIPHY"/"Tenor" (gif-search-dialog.tsx:142), `+{hidden}` (presence-strip.tsx:59), typographic quotes around card text in DnD announcements (dnd.tsx:54). Everything else goes through `t()`; labels held in constant maps (`PhaseLabels`, `columnColorLabel`, `SentimentLabels`) are translated at render.

**Could not verify**
- Exact wire shape of `live-cursors` / `live-reactions` whisper messages beyond what the app reads (`e` for the emoji, `meta.p` pointer type, sender via Reverb `user_id` metadata) — library internals not inspected.
- That Reverb actually stamps `user_id` on client events at runtime (taken from the code comment + config/reverb.php:90).
- Presence of every `t()` key in `lang/*.json` (not checked).
- Internals of `useGameRoom`, game event payloads, `survey-api.ts` refetcher, `AuthLayout`, `LanguageSwitcher`, and all sibling-owned components (only their mount points were noted).
- Rendering of non-JSON 401/403/404 on `GET retros/{retro}` for logged-in non-members (Inertia error page handling not traced).
- `gifs.show` and `emoji-data.show` controllers (only route names/URLs noted).
- Line numbers for backend controllers other than the three `Inertia::render` sites were read from comment-stripped dumps and are given by method name rather than line.


---

<!-- part: 02-retro-secondary -->

## pages/retros/show.tsx — secondary features

Scope: surveys, health check, ROTI, action items (own + carried), AI insights/summary, results (completed) view, sharing. The board core (columns, cards, votes, reactions, comments, timer, phases, settings, presence, cursors, facilitator menu, guest link, full props, full realtime table) is in the sibling slice.

Paths are relative to `/Users/aritti/Projects/skrum`. `c/retro/` = `resources/js/components/retro/`, `c/ai/` = `resources/js/components/action-items/`.

### 0. Common plumbing these features rely on

**Route / render.** `GET retros/{retro}` `retros.show` → `Retros\RetrosController@show` (`app/Http/Controllers/Retros/RetrosController.php:21`), single prop `snapshot` built by `App\Actions\Retros\BuildBoardSnapshot::handle` (`app/Actions/Retros/BuildBoardSnapshot.php:63`). Every route below sits in the `retros/{retro}` group (`routes/web.php:369-373`): `whereUuid('retro')`, middleware `ResolveRetroParticipant`, `scopeBindings()`. No `auth` middleware: the acting identity is `Participant::current($request)` (member or guest).

**Where each feature mounts** (`c/retro/board.tsx`):

| Feature | Mount point | Phase condition |
|---|---|---|
| `HealthCheckPanel` | `PhasePanel` (`phase-panel.tsx:7-12`, `board.tsx:254`) | `health_check` only |
| `SurveysColumn` | first child of the board `<main>` (`board.tsx:316`) | `writing`,`grouping`,`voting`,`discussing` AND at least one survey (`surveys-column.tsx:14-19`) |
| `AddSurveyButton` | header (`board-header.tsx:61`) | same 4 phases, facilitator, unlocked, < 10 surveys |
| `CarriedActionItemsPanel` | header actions (`board.tsx:246`) | every phase except `completed`, members only |
| `ShareBoardButton` | header actions (`board.tsx:248`) | every phase except `completed` |
| `SuggestionsPanel` + `ActionItemsPanel` (which contains `RotiControl`) | right side (`board.tsx:349-354`) | `discussing` only |
| `CompletedTabs` + `ResultsView` | `board.tsx:255-270` | `completed` only |
| `CardInsight` | inside each card (`retro-card.tsx:131`) | whenever the card has `sentiment`/`category` |
| `AiSummarySwitch` | `settings-dialog.tsx:333-341` and `components/teams/new-retro-dialog.tsx` | sibling slices |

Note: in `completed`, the "Board" tab renders the same board `<main>` but `SurveysColumn`, `SuggestionsPanel`, `ActionItemsPanel` are all hidden (their phase checks fail); surveys/action items/suggestions are only visible in the Results tab then.

**HTTP helper.** All calls go through `retroRequest()` (`resources/js/lib/retro/api.ts:38`): Inertia's `http` client, `Accept: application/json`, `X-Socket-ID` header (so `->toOthers()` broadcasts skip the actor), 15 s timeout (45 s for exports), throws `RetroRequestError(status, message, errors)`; `message` = first validation error, else `message`, else transport message; timeout → status 0. Nothing here is an Inertia visit: every endpoint below returns JSON.

**`ctx.run(promise)`** (`resources/js/hooks/use-retro-board.ts:520-538`): on failure → 401/419 sets `sessionExpired` (banner, whole board `inert`, returns `undefined` silently); otherwise `toast.error(message)` then **full snapshot refetch** (`GET retros/{retro}/snapshot`, `retros.snapshot.show`), returns `undefined`. This is the universal rollback for optimistic updates.

**`ctx.apply` vs `ctx.dispatch`**: `apply` buffers actions while a snapshot refetch is in flight and replays them after it (`use-retro-board.ts:62-80`); `dispatch` is immediate (used for optimistic updates).

**`ctx.isEditable`** = `!board.retro.isLocked` (`board.tsx:129`). Server equivalent: `RetroGuard::unlocked` → HTTP **423** "The board is closed for editing." (`app/Actions/Retros/RetroGuard.php:41-48`).

**Server guards** (no Policies/FormRequests are used for these features; all authorization is inline): `RetroGuard::phase/open/unlocked/facilitator/commentAuthor/reactionsEnabled` (`app/Actions/Retros/RetroGuard.php`), `SurveyGuard` (`app/Actions/Surveys/SurveyGuard.php`), `SuggestionGuard` (`app/Actions/Retros/SuggestionGuard.php`), `ActionItemPermissions` (`app/Actions/ActionItems/ActionItemPermissions.php`), `SharePermissions` (`app/Actions/Integrations/SharePermissions.php`), `ActionItemExportGuard` (`app/Actions/Integrations/ActionItemExportGuard.php`). `AuthorizationException` → 403, `ValidationException` → 422. Every mutating controller re-checks its guards inside a transaction on the retro row locked `FOR UPDATE`.

**Snapshot sub-shapes consumed by this slice** (TS `Snapshot`, `resources/js/lib/retro/types.ts:269-338`; all present and matching in `BuildBoardSnapshot.php:90-185`):

- `retro.phase`, `retro.isLocked`, `retro.isAnonymous`, `retro.reactionsEnabled`, `retro.guestAccessEnabled`, `retro.completedAt`, `retro.teamId`, `retro.aiSummaryEnabled`, `retro.id`.
- `viewer.{participantId,userId,isFacilitator,isGuest,isWorkspaceManager,isReviewFacilitator,facilitatedRetroIds,canHandleSuggestions}`. `isReviewFacilitator = isFacilitator && phase != completed` (`:126`); `facilitatedRetroIds` = all retros of the team this user facilitates (`:218-232`); `canHandleSuggestions` = `SuggestionGuard::allows` (`:130`).
- `surveys: SurveyPayload[]` — `PresentSurvey::many` (`app/Actions/Surveys/PresentSurvey.php:33`, shape `:48-66`).
- `healthCheck: {statements: HealthCheckStatement[]} | null` — `PresentHealthCheck` (`app/Actions/HealthCheck/PresentHealthCheck.php:29`); null when health check is disabled and has no answers.
- `roti: {myScore, respondents}` — `BuildBoardSnapshot::roti` (`:291-299`).
- `actionItems: ActionItem[]` (own retro, sorted by `created_at`), `carriedActionItems`, `carriedActionItemsHasMore` — `PresentActionItem` (`app/Actions/Retros/PresentActionItem.php:46`), `CarriedActionItems` (`app/Actions/ActionItems/CarriedActionItems.php:22`, limit 200). Carried is `[]`/`false` for guests.
- `exportSources: ExportSource[]` (`[]` for guests) — `ListExportSources::forTeam`.
- `teamMembers: TeamMember[]` (sent to guests too, no emails; `:199-213`), `participants`.
- `insights: {themes, suggestedActions} | null` — `BuildInsights` (`app/Actions/Retros/BuildInsights.php:24`): null unless LLM configured AND phase ∈ {discussing, completed}.
- `results: Results | null` — `BuildResults` (`app/Actions/Retros/BuildResults.php:48`): null unless phase = completed.
- `features: {llm, llmProvider}`.
- `integrations: {slack,telegram,msteams,mattermost,webhook,email}` — `ShareOptions::retro` (`app/Actions/Integrations/ShareOptions.php:42`): **all false unless the viewer may share**.
- `linkDeliveries: IntegrationDelivery[]` — newest `retro_link` delivery per channel, `[]` unless viewer may share (`:166`).
- `links.{team,actionItems,workspace}` — all `null` for guests (`:169-175`).
- Cards' `sentiment`, `category` (null unless LLM configured and card not hidden; `PresentCard::insights`, `app/Actions/Retros/PresentCard.php:67-75`).

Mismatch/unused: `viewer.canManageActionItems` is sent (`BuildBoardSnapshot.php:124`) and typed (`types.ts:301`) but **never read** by any front code. Shared props read by this slice: only `locale` (`usePage().props.locale` for date formatting in `carried-action-items-panel.tsx:67`, `due-date-chip.tsx:13`, `recurrence-select.tsx:84`, `action-item-comments.tsx:40`, `external-link-chips.tsx:46`, `delivery-lines.tsx:14`, `results-view.tsx:20`).

**Layout**: sibling slice (page has no persistent layout; `pages/retros/show.tsx` renders `<Head>` + `<Board>`).

---

### 1. Surveys

Files: `c/retro/surveys-column.tsx`, `survey-card.tsx`, `survey-menu.tsx`, `survey-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx`, shared `comment-thread.tsx`, `reaction-chips.tsx`, `resources/js/lib/retro/survey-api.ts`, `c/retro/results/survey-result.tsx`.

Constants: `SurveyPhases = writing|grouping|voting|discussing`, `MaxSurveys = 10`, `SurveyRefetchDelayMs = 1000` (`survey-api.ts:5-14`); options 2..10 (`survey-dialog.tsx:29-30`); server mirrors: `SurveysController::MaxSurveys/MinOptions/MaxOptions` (`SurveysController.php:24-28`), `SurveyGuard::activePhase` (`SurveyGuard.php:15-18`).

**Visibility rule (privacy, must be preserved):** counts, voters, text answers, reactions and comments are only sent to a viewer once `resultsVisible` = survey closed OR viewer has answered (`PresentSurvey.php:75`). Before that: `options[].count = null`, `voters = null`, `textAnswers = null`, `reactions = []`, `comments = []`, but `commentCount` and `responseCount` are always sent. `showVoters` in the payload is already `show_voters && !retro.is_anonymous`. Text answers are sorted by text (not time) and carry `authorId` only when names are shown.

#### Actions

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Open "New survey" dialog | `AddSurveyButton` "Add survey" (`surveys-column.tsx:51-54`) | client-only | Facilitator (`viewer.isFacilitator`), phase ∈ SurveyPhases, `isEditable`, `< 10` surveys (`:40-47`). Dialog forced closed when `sessionExpired`. |
| Generate a draft with AI | `SurveyDraftField` input + "Generate" button, Enter key in the prompt (`survey-draft-field.tsx:65-86`); only in create mode (`survey-dialog.tsx:164`) and only if `features.llm` (`:31`) | `POST retros/{retro}/survey-drafts` `retros.survey-drafts.store` → `SurveyDraftsController@store` (`:22`). Body `{prompt (≤300), kind}`. Returns `{question, description, options}` (not persisted) | Facilitator; server: LLM configured else **404**, `RetroGuard::facilitator`, `SurveyGuard::activePhase`, `unlocked`, 10 drafts/min per participant (429 "Too many requests, wait a moment."), 502 "Could not generate a survey…" on bad LLM output. Result fills question/description, and options unless the kind is `text` (`survey-dialog.tsx:167-176`). Error shown inline via `InputError` (not toast). Disclosure line: "Your prompt and the retro title are sent to :provider." |
| Create survey | `SurveyForm` submit "Save" (`survey-dialog.tsx:111-156`): answer type select (single/multiple/text), question (required, ≤200), description (≤500), options (each required ≤100; add up to 10, remove down to 2), "Show who answered" checkbox (disabled + note when retro anonymous) | `POST retros/{retro}/surveys` `retros.surveys.store` → `SurveysController@store` (`:37`). Body `{kind, question, description|null, options[] ([] for text), show_voters}`. 201 `{survey}` | Facilitator; server `authorizeEditing` = facilitator + activePhase + unlocked (`:170-175`); 422 at 10 surveys, wrong option count, options on a text survey, `show_voters` on anonymous retro. On success `invalidateSurvey` + `apply survey.upsert`, dialog closes. On error: inline message; if session expired the dialog just closes. |
| Edit survey | `SurveyMenu` → "Edit survey" (`survey-menu.tsx:84-89`) → same dialog prefilled, no AI field | `PATCH retros/{retro}/surveys/{survey}` `retros.surveys.update` → `SurveysController@update` (`:76`) (full body as for create) | Facilitator, `isEditable`, SurveyPhases, **and `responseCount === 0`** (menu item disabled + hint "Edit is only possible before the first answer."). Server `SurveyGuard::unanswered` → 422 "This survey already has answers."; bumps `version`; replaces all options. |
| Toggle "Show who answered" | `SurveyMenu` checkbox item (`survey-menu.tsx:97-110`) | `PATCH retros/{retro}/surveys/{survey}` with body exactly `{show_voters}` → `updateVoterVisibility` branch (`SurveysController.php:80-82,138-168`) | Facilitator; disabled when retro anonymous. Server: facilitator + `RetroGuard::open` (any non-completed phase) — **not** blocked by a locked board, and the front does not disable it when locked either. |
| Close / reopen survey | `SurveyMenu` item "Close survey"/"Reopen survey" (`:111-129`) | `PUT` / `DELETE retros/{retro}/surveys/{survey}/closure` `retros.surveys.closure.update/destroy` → `SurveyClosuresController` (`:20,25`) | Facilitator; server facilitator + `open`; works on a locked board too. Closing reveals results to everyone. Surveys are auto-closed when the retro completes (`CloseOpenSurveys`, `ChangeRetroPhase.php:105-112`). |
| Delete survey | `SurveyMenu` → "Delete survey" (destructive, disabled unless `canEdit`) → confirm dialog "Delete this survey? Its answers, reactions and comments are deleted too." (`:131-172`) | `DELETE retros/{retro}/surveys/{survey}` `retros.surveys.destroy` → `SurveysController@destroy` (`:117`), 204 | Facilitator, unlocked, SurveyPhases. Then `apply survey.remove`. |
| Answer single-choice | one button per option, immediate submit, `aria-pressed` (`survey-card.tsx:183-198`) | `PUT retros/{retro}/surveys/{survey}/response` `retros.surveys.response.update` → `SurveyResponsesController@update` (`:24`). Body `{optionId}` | Any participant incl. guests. Front `canAnswer` = `isEditable && !isClosed && phase ∈ SurveyPhases` (`:37-40`). Server: activePhase + unlocked + `SurveyGuard::open` (422 "This survey is closed."); rules depend on the kind and `prohibit` the other keys (`:91-113`). Re-clicking the selected option re-sends the same answer (no toggle). |
| Answer multiple-choice | checkboxes (local selection) + "Submit"/"Update answer" button, disabled when empty or unchanged (`:162-224`) | same endpoint, body `{optionIds: [...]}` (ordered as the options) | same |
| Answer free text | textarea (≤500) + "Submit"/"Update answer", disabled when empty/unchanged (`:288-320`) | same endpoint, body `{text}` | same |
| Withdraw my answer | link button "Withdraw my answer" (shown when `canAnswer && hasAnswered`) (`:123-133`) | `DELETE retros/{retro}/surveys/{survey}/response` `retros.surveys.response.destroy` (`:46`) | same. Withdrawing hides results again for that viewer (unless closed). |
| See results | `OptionResult` bar + `%·count`, voter avatars with tooltip of names when `voters` present (`:229-278`); `TextAnswerList` with own answer highlighted, author name when shown, "No answers yet." (`:329-374`) | none | Only when `resultsVisible` |
| Toggle a reaction on a survey | `ReactionChips` chips + emoji picker (`survey-discussion.tsx:134-140`), only rendered if `retro.reactionsEnabled` | `PUT` (add) / `DELETE` (remove) `retros/{retro}/surveys/{survey}/reactions` `retros.surveys.reactions.update/destroy` → `SurveyReactionsController` (`:22,27`). Body `{emoji}` (also sent as body on DELETE) | `canDiscuss` = `isEditable && resultsVisible && phase ∈ SurveyPhases` (`:20-23`). Server: activePhase + unlocked + `reactionsEnabled` + `SurveyGuard::resultsVisible` (403 "Answer the survey to join the discussion."). **Optimistic** via `dispatch survey.upsert` with `optimisticReactions` (`reaction-chips.tsx:79-105`), then replaced by the response. |
| Expand/collapse discussion | comment-count button, `aria-expanded` (`:141-151`) | client-only | when `resultsVisible`; otherwise a static line "{n} · Answer to join the discussion" (`:28-38`) |
| Add comment / reply | `CommentForm` (textarea ≤500, Enter submits, Shift+Enter newline) (`comment-thread.tsx:236-324`); "Reply" only on top-level, non-deleted threads | `POST retros/{retro}/surveys/{survey}/comments` `retros.surveys.comments.store` → `SurveyCommentsController@store` (`:28`). Body `{content, parentCommentId}` (camelCase). 201 `{comment}` | `canDiscuss`. Server guard: activePhase + unlocked + resultsVisible; reply must belong to the same survey (422); replies to replies are attached to the thread root (`threadIdFor`). After success the client **refetches the survey** (`GET …/surveys/{survey}`) rather than patching. Composer note "Your name is shown with your comment." when `!survey.showVoters && !retro.isAnonymous` (`:157-161`). |
| Edit own comment | pencil button → inline form (`comment-thread.tsx:205-215`) | `PATCH retros/{retro}/survey-comments/{surveyComment}` `retros.survey-comments.update` (`SurveyCommentsController@update:63`). Body `{content}` | Author only (`comment.isMine`; server `RetroGuard::commentAuthor`), 404 if already deleted |
| Delete comment | trash button (`:216-227`) | `DELETE retros/{retro}/survey-comments/{surveyComment}` `retros.survey-comments.destroy` (`:94`), 204 | Author **or facilitator** (`canDelete`, `:161-162`; server `guardDeletion:124-133`). A parent with replies is soft-deleted (renders "Comment deleted"); deleting the last reply of a soft-deleted parent removes the parent (`:139-156`). |
| Expand replies | "1 reply"/":count replies" link button, `aria-expanded` (`:90-102`) | client-only | all |
| Refetch one survey | `fetchSurvey` (`survey-api.ts:16-25`) | `GET retros/{retro}/surveys/{survey}` `retros.surveys.show` → `SurveysController@show` (`:32`) | any participant (no guard besides the route middleware) |

Completed view (`results/survey-result.tsx`): each `results.surveys[]` entry shows question, description, "Several answers allowed", option bars / text answers, response count, and `SurveyDiscussion` in **read-only** mode (`canDiscuss` false because phase ∉ SurveyPhases → reactions disabled, no composer, no edit/delete buttons; threads can still be expanded). `SurveyMenu` returns null in `completed` (`survey-menu.tsx:36`).

#### Realtime (surveys)

| Channel | Event | Payload (class) | Client behaviour (`use-retro-board.ts`) |
|---|---|---|---|
| presence `retro.{id}` | `.survey.changed` | `{surveyId, version, responseCount}` (`app/Events/Retros/SurveyChanged.php`) — fired on create, edit, voter-visibility toggle, close/reopen, answer, withdraw | `survey.counts` (responseCount) immediately; then, if the survey is unknown locally, its `version` differs, or the viewer can see results (`needsSurveyRefetch`, `survey-api.ts:31-40`), schedule a per-survey refetch **debounced 1 s** (`createSurveyRefetcher`) → `survey.upsert`; 404 → `survey.remove` (`:282-299, 495-517`) |
| presence `retro.{id}` | `.survey.deleted` | `{surveyId}` (`SurveyDeleted.php`) | cancel pending refetch + `survey.remove` (`:301-308`) |
| presence `retro.{id}` | `.survey.discussion.changed` | `{surveyId, commentCount}` (`SurveyDiscussionChanged.php`) — comments and reactions | `survey.counts` (commentCount); refetch scheduled only if local `resultsVisible` (`:310-327`) |
| private `participant.{participantId}` | `.own-survey-comment.saved` | `{comment}` (`OwnSurveyCommentSaved.php`) — to the author's other tabs | schedules a refetch of that survey (`:392-395`) |
| private `participant.{participantId}` | `.comment.notification` | `{surveyId, commentId, threadId, excerpt, authorName?}` (`CommentNotification.php`; built `SurveyCommentsController.php:183-211`) — sent to the survey creator and thread participants, only those who already see results | toast "New comment on your survey" / "New reply in a thread you follow" with `authorName: excerpt` (`:398-418`). No unread dot for surveys (dots are card-only). |

All use `sendToOthers()` (actor excluded via `X-Socket-ID`); the actor updates from the HTTP response and calls `invalidateSurvey(id)` to drop any pending/in-flight refetch that would overwrite it (`survey-api.ts:68-72`). Reducer: `survey.upsert` re-sorts by `position` (`board-reducer.ts:624-633`).

State worth preserving: `key={survey.myOptionIds.join()}` / `key={survey.myText}` remount the answer inputs when the server answer changes; the "Closed" badge; `busy` guards against double submits; the stale-response protection (`latestRequests` counter).

---

### 2. Health check

File: `c/retro/health-check-panel.tsx`. Shown only in phase `health_check` (which exists only if `retro.healthCheckEnabled`; `Retro::phases()`), replacing nothing — the board below still renders. Intro: "Rate each statement from 1 (Awful) to 10 (Great). Only you see your own scores."

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Score a statement 1..10 | 10 buttons in a `role="radiogroup"`, each `role="radio"` + `aria-checked` + `aria-label="Score n"` (`:106-128`) | `PUT retros/{retro}/health-check/{statement}` `retros.health-check.update` → `HealthCheckAnswersController@update` (`:20`). Body `{score}` (int 1..10). Returns `{statement, score, statements: HealthProgress[]}` | Any participant incl. guests. Disabled when `busy` or `!isEditable`. Server: `RetroGuard::phase(HealthCheck)` + `unlocked`; unknown statement key → 404; route constraint `[A-Za-z0-9_-]{1,64}`. |
| Clear my score | "Clear" ghost button, only when `myScore !== null` (`:159-169`) | `DELETE retros/{retro}/health-check/{statement}` `retros.health-check.destroy` (`:46`). Returns `{statements}` | same |

- **Optimistic**: `dispatch({type:'health.answer', key, score})` before the request; response's `statements` applied as `health.progress`; failure → toast + snapshot refetch (rollback).
- Per statement: text, a check icon (`aria-label="Answered"`) when the viewer answered, "Awful"/"Great" scale labels, up to 8 respondent avatars with name tooltips, ":count answered".
- **Anonymity**: `answeredBy` is `[]` on anonymous retros (`PresentHealthProgress.php:32`) → no avatars, count only. Individual scores are never sent to others.
- Realtime: `.health.answered` on presence `retro.{id}`, payload `{statements: [{key, count, answeredBy}]}` (`HealthAnswered.php`) → `health.progress` (keeps `myScore`).
- Results side: see §6 (radar, trend, stats).

---

### 3. ROTI (return on time invested)

File: `c/retro/roti-control.tsx`; mounted at the bottom of `ActionItemsPanel` (`action-items-panel.tsx:110-112`, phase `discussing`) and in `results/roti-section.tsx:13` (phase `completed`).

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Rate 1..5 | 5 buttons in `role="group"` "How was this retro?" with labels Time wasted / Not really worth it / Break-even / Good use of time / Excellent use of time, `aria-pressed` (`:59-84`) | `PUT retros/{retro}/roti` `retros.roti.update` → `RetroRotiController@update` (`:17`). Body `{score}` (1..5). Returns `{myScore, respondents}` | Any participant incl. guests |
| Remove my rating | click the currently selected score again (`:32-33`) | `DELETE retros/{retro}/roti` `retros.roti.destroy` (`:42`) → `{myScore: null, respondents}` | same |

- Server guard: phase ∈ {Discussing, Completed} only (`:61-64`). **No `unlocked` check** and the front only disables on `busy` → ROTI stays usable on a locked board and after completion.
- Not optimistic: applies `roti.set` from the response; in `completed` it additionally does a full snapshot refetch to refresh `results.roti` (`:51-53`).
- Shows ":count rating(s)" (respondent count only; scores are anonymous).
- Realtime: `.roti.changed` `{respondents}` (`RotiChanged.php`) → `roti.set` (keeps `myScore`); in `completed` also a **debounced (1 s) snapshot refetch** (`use-retro-board.ts:336-345`).

---

### 4. Action items inside the retro

Two surfaces share `c/ai/*`:

1. **`ActionItemsPanel`** (`c/retro/action-items-panel.tsx`) — this retro's items, phase `discussing`. Endpoints = `boardActionItemEndpoints(retroId)` (`resources/js/lib/action-items/endpoints.ts:39-88`) → `retros.action-items.*`.
2. **`CarriedActionItemsPanel`** (`c/retro/carried-action-items-panel.tsx`) — the team's earlier open follow-ups, in a right-hand `Sheet`. Endpoints = `workspaceActionItemEndpoints(workspaceSlug)` (`endpoints.ts:90-150`) → `workspaces.actionItems.*` (documented by the workspace sibling; listed briefly below).

Both build the viewer with `boardActionItemViewer(board)` (`resources/js/lib/action-items/permissions.ts:67-77`).

#### Permission model (client mirror of `ActionItemPermissions`)

- **manage** (edit content/priority/due date/recurrence/assignee, delete, add/rename/reorder/delete sub-tasks, export, retry sync) = `item.isMine || viewer.isWorkspaceManager || facilitatedRetroIds.includes(item.retroId)` (`permissions.ts:19-31`; server `isManager`, `ActionItemPermissions.php:156-167`: author, facilitator of the item's retro, workspace Owner/Admin).
- **complete** (tick the item, tick sub-tasks) = manage OR viewer is the assignee (member by `userId`, guest by `participantId`) OR `reviewTeamIds.includes(item.teamId)` i.e. `viewer.isReviewFacilitator` (facilitator of a running retro of the team) (`permissions.ts:33-57`; server `canComplete:31-42`).
- **comment**: anyone on the board (`canWrite = editable`); server `canComment` = participant of the item's retro, or user who can view the team.
- **edit comment**: author only; **delete comment**: author or manager (`permissions.ts:59-65`).
- Everything is additionally gated by `editable` (`ActionItemsPanel`: `ctx.isEditable`; carried panel: always `true`).
- Server (retro endpoints): every mutation calls `guardDiscussing` = phase **Discussing** + unlocked (`app/Http/Controllers/Concerns/LocksDiscussingRetro.php:12-16`); so own-retro items cannot be changed through the retro endpoints in any other phase. Exceptions: comments `index` (no phase guard), exports and link sync (any phase, see below).
- Notice "Action items are not anonymous: your name is shown." (`anonymous-notice.tsx`) above the create form and the comment composer when `retro.isAnonymous`.

#### Actions — own retro panel (phase `discussing`)

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Create action item | `ActionItemForm` (`c/ai/action-item-form.tsx`): content input (≤500), priority select (high/medium/low, default medium), due date `<input type=date>` (2000-01-01..2100-12-31), repeat select (disabled until a due date is set; clearing the date resets recurrence), assignee select, "Add" button | `POST retros/{retro}/action-items` `retros.action-items.store` → `Retros\ActionItemsController@store` (`:34`). Body `{content, priority, due_on|null, recurrence|null, assignee_user_id|null, assignee_participant_id|null}`. 201 `{actionItem}` | Any participant incl. guests; disabled when board locked. Rules `ActionItemRules::create(allowsGuests: true)` (`app/Actions/ActionItems/ActionItemRules.php:15-21,60-69`). |
| Assignee options | `boardAssigneeGroups` (`assignee-select.tsx:39-66`): "Unassigned"; group "In this retro" = team members who joined + guests (`:name (guest)`); group "Team" = other team members. A current assignee no longer listed shows as a disabled item (`:name (not in team)` / `(guest)`) | — | value encoding `member:{userId}` / `guest:{participantId}` / `none` → `assigneePayload` (`lib/action-items/assignees.ts:17-32`) |
| Mark done / reopen | checkbox, `aria-label` "Mark as done"/"Reopen" (`action-item-card.tsx:177-187`) | `PATCH retros/{retro}/action-items/{actionItem}` `retros.action-items.update` (`ActionItemsController@update:54`). Body `{status: 'completed'|'open'}` | complete permission |
| Edit content | pencil → inline input (≤500), Enter/“Save” submits, Escape cancels (`:189-216, 281-294`) | same PATCH, `{content}` | manage |
| Change priority | `PrioritySelect` (`:318-322`) | same PATCH, `{priority}` | manage |
| Change due date | date input, saved **on blur** (ignored for partial/invalid input; reverts on failure) (`:323-338, 157-169`) | same PATCH, `{due_on}` | manage |
| Change recurrence | `RecurrenceSelect` (Does not repeat / Weekly / Every 2 weeks / Monthly), disabled when no due date (`:340-344`) | same PATCH, `{recurrence}` | manage |
| Change assignee | `AssigneeSelect` (`:345-351`) | same PATCH, `{assignee_user_id, assignee_participant_id}` | manage |
| Delete | trash button — **no confirmation** (`:295-306`) | `DELETE retros/{retro}/action-items/{actionItem}` `retros.action-items.destroy` (`:67`), 204 | manage |
| Add sub-task | input (≤200) + "Add" (hidden at 20 sub-tasks) (`subtask-checklist.tsx:224-249`) | `POST retros/{retro}/action-items/{actionItem}/subtasks` `retros.action-items.subtasks.store` → `ActionItemSubtasksController@store` (`:32`). `{content}` → `{actionItem}` | manage |
| Tick sub-task | checkbox (`:106-116`) | `PATCH retros/{retro}/action-item-subtasks/{actionItemSubtask}` `retros.action-items.subtasks.update` (`:49`). `{status}` | complete. Ticking all sub-tasks never completes the item. |
| Rename sub-task | pencil → inline input, Escape cancels (`:117-147,189-202`) | same PATCH, `{content}` | manage |
| Move sub-task up/down | arrow buttons "Move up"/"Move down" (`:157-188`) — no drag and drop | same PATCH, `{position: index∓1}` (0..19) | manage |
| Delete sub-task | trash (`:203-218`) | `DELETE retros/{retro}/action-item-subtasks/{actionItemSubtask}` `retros.action-items.subtasks.destroy` (`:71`) → `{actionItem}` | manage |
| Open comments | "N comments" toggle, `aria-expanded`/`aria-controls` (`action-item-card.tsx:352-365`) → lazy load | `GET retros/{retro}/action-items/{actionItem}/comments` `retros.action-items.comments.index` → `ActionItemCommentsController@index` (`:32`) → `{comments}` | all. States: "Loading…", "Could not load the comments." + "Retry", "No comments yet." (`action-item-comments.tsx:178-202`). Re-fetched whenever `item.commentsRevision` is bumped by a realtime event. |
| Add comment | textarea (≤500) + "Comment" (`:296-322`) | `POST retros/{retro}/action-items/{actionItem}/comments` `retros.action-items.comments.store` (`:46`). `{content}` → 201 `{comment}` | all (`canWrite`) |
| Edit comment | pencil → textarea, Save/Cancel (`:215-231, 250-287`) | `PATCH retros/{retro}/action-item-comments/{actionItemComment}` `retros.action-items.comments.update` (`:59`) | comment author |
| Delete comment | trash (`:232-248`) | `DELETE retros/{retro}/action-item-comments/{actionItemComment}` `retros.action-items.comments.destroy` (`:72`), 204 | comment author or manager |
| Export to tracker | upload icon; one button if a single tracker is available, dropdown "Export to :provider" if several; hidden once exported to every connected tracker (`export-action-item-button.tsx:44-95`) → `ExportActionItemDialog` | see below | manage AND `viewer.userId !== null` (never guests) AND `links.workspace !== null` (`action-item-card.tsx:272`, `action-items-panel.tsx:25-32`) |
| Open external issue | chip link `key ↗` (`target=_blank`), status dot, tooltip "status in source · synced x ago" / "Sync pending" / "Sync failed: …" / "Not found in :source" (`external-link-chips.tsx`) | none | members (guests get `externalLinks: []`) |
| Retry a failed sync | refresh icon next to a `failed` chip (`:137-147`) | `POST retros/{retro}/action-items/{actionItem}/external-links/{externalLink}/sync` `retros.action-items.external-links.sync.store` → `Integrations\RetroActionItemLinkSyncsController@store` (`:23`), 202 `{actionItem}`; middleware `EnsureIntegrationProviderEnabled`, `throttle:10,1,actionItemLinkSyncs` | manage; server `RequestActionItemPush` (`app/Actions/Integrations/RequestActionItemPush.php`): no guests, edit rights, status sync on (409), same site (409). Toast "Sync requested." |

**Export dialog** (`c/ai/export-action-item-dialog.tsx`), per provider (`jira`/`jira_dc`: project search + project + issue type; `github`: repository search + repository; `linear`: team):

| Step | Endpoint |
|---|---|
| Load targets (and on project change / search, debounced 300 ms) | `GET w/{workspace}/teams/{team}/integrations/{integration}/targets?project_id=&q=` → `Integrations\IntegrationTargetsController@index` (`Gate::authorize('view', $team)`) — a **workspace** route called from the retro page. Error → inline "Could not reach :provider." or server message |
| Preview assignee/priority mapping | `GET retros/{retro}/action-items/{actionItem}/exports/preview?source=` `retros.action-items.exports.preview` → `RetroActionItemExportPreviewsController@show` (`:19`) → `{assignee:{state,displayName}, priority:{name}}`; failures silently hide the preview |
| Export | `POST retros/{retro}/action-items/{actionItem}/exports` `retros.action-items.exports.store` → `RetroActionItemExportsController@store` (`:29`). Body `{source, project_id, issue_type_id}` / `{source, repository_id}` / `{source, team_id}`. 201 `{actionItem, warnings[]}`; 45 s timeout; toast "Exported as :key." + one `toast.warning` per warning |
| "Manage people" link | Inertia `<Link>` to `TeamIntegrationsController.index({workspace, team})`, only when `viewer.isWorkspaceManager` |

Export/preview guard: `ActionItemExportGuard::authorize` = user (no guests, 403 "Guests cannot export action items.") + edit rights; integration must be enabled (404), connected and writable. Per the controller docblock, exports are allowed in any phase (`RetroActionItemExportsController.php:17-20`).

Card meta shown (`action-item-card.tsx:224-270`): priority icon, due chip ("Due :date" / red "Overdue · :date"), recurrence badge ("Repeats weekly…" + "Follows up the item completed on :date" when `previousOccurrenceId`), sub-task progress `done/total`, creator avatar + name ("Former member" fallback), "Theme: :name" badge (items promoted from AI suggestions), external link chips, "Completed in :source" when completed by tracker sync. Each `<li>` has `id="action-item-{id}"` (anchor target for promoted suggestions). Empty state: "No action items yet.".

#### Carried ("Previous action items") panel

- Visible when `!viewer.isGuest && links.workspace !== null && phase !== 'completed' && carriedActionItems.length > 0` (`carried-action-items-panel.tsx:78-82`). Header button "Previous action items (:count)" where count = **open** items only.
- **Auto-opens once per retro per browser**: if the phase at mount was `writing` and `localStorage['skrum.carriedSeen.{retroId}']` is unset, it sets it to `'true'` and opens the sheet (`:84-102`).
- Content: items grouped by source retro (newest retro first; group "Added outside a retro" last), each group titled with the retro title + formatted creation date (`groupCarriedActionItems`, `:36-62`). If `carriedActionItemsHasMore` → link "View all on the action items page"; footer button "Open the action items page" (both Inertia `<Link>` to `links.actionItems` = `workspaces.actionItems.index?team=`).
- Each item is the same `ActionItemCard` with `editable` always true (not tied to this board's lock), assignees limited to `teamAssigneeGroups(board.teamMembers)` (no guests), and the **workspace** endpoints: `PATCH/DELETE w/{workspace}/action-items/{actionItem}`, `GET/POST …/comments`, comment/sub-task update & delete, `POST …/subtasks`, `POST …/exports`, `GET …/exports/preview`, `POST …/external-links/{externalLink}/sync` (`workspaces.actionItems.*`, `workspaces.actionItemLinkSyncs.store`). Those refuse a non-empty `assignee_participant_id` and are frozen (423) only when the item's own source retro is locked and still running (`WorkspaceActionItemGuard::writable`).
- Completed carried items stay in the list struck through for the rest of the retro (server rule `CarriedActionItems.php:31`); list re-sorted with `compareActionItems` on each upsert (`board-reducer.ts:504-511`, `lib/action-items/order.ts`).

#### Realtime (action items)

| Channel | Event | Payload | Client |
|---|---|---|---|
| presence `retro.{id}` | `.action-item.saved` | `{actionItem}` presented **without viewer** (`isMine:false`, `externalLinks:null`, `completedVia:null`) (`ActionItemSaved.php`) | `actionItem.upsert`; `upsertActionItem` keeps the locally known `isMine`, `externalLinks`, `completedVia`, `commentsRevision` (`board-reducer.ts:~325-345`) |
| presence `retro.{id}` | `.action-item.deleted` | `{actionItemId}` | `actionItem.remove` |
| presence `retro.{id}` | `.action-item.comments.changed` | `{actionItemId, commentCount}` | `actionItem.comments` with `refresh:true` → bumps `commentsRevision` → an open thread refetches its comments |
| private `retro-members.{id}` (members only; `useRetroChannel(..., membersOnly = !viewer.isGuest)`, auth `BroadcastAuthorizationsController.php:241-257` rejects guests) | `.carried-action-item.saved` | `{actionItem}` | `carriedActionItem.upsert` (+ sort) |
| same | `.carried-action-item.removed` | `{actionItemId}` | `carriedActionItem.remove` |
| same | `.carried-action-item.comments.changed` | `{actionItemId, commentCount}` | same as comments.changed |
| same | `.action-item.external-links.changed` | `{actionItemId, externalLinks[]}` | `actionItem.externalLinks` on both lists |

Emitted centrally by `BroadcastActionItemChange` (`app/Actions/ActionItems/BroadcastActionItemChange.php`): own-board events only while the item's retro is not completed; carried events to every running retro of the team created after the item's anchor; plus `TeamActionItem*` events on the team channel (workspace page, sibling). Local comment count changes use `actionItem.comments` with `refresh:false`.

Completed view: `results/action-items-results.tsx` is a **read-only** list (priority icon, "Done" check, struck-through content, due chip, theme badge, assignee label) + link "View the team's action items" (`links.actionItems`, members only). No editing of own-retro items is possible from the retro page once completed, except promoting an AI suggestion (§5).

---

### 5. AI insights (summary, themes, suggested actions, card insights)

Files: `c/retro/suggestions-panel.tsx`, `insights/suggestions-list.tsx`, `insights/summary-section.tsx`, `card-insight.tsx`, `ai-summary-switch.tsx`. Everything is hidden when no LLM is configured (`features.llm=false` ⇒ `insights=null`, `results.summary=null`, card `sentiment/category=null`).

Data lifecycle (server): a summary job is queued when the retro reaches `completed` with `ai_summary_enabled` and an LLM configured (`ChangeRetroPhase.php:128-140`) or on demand by the facilitator. The job writes the summary text, themes (with card ids), suggested actions and per-card `sentiment`/`category` (`StoreRetroInsights.php:20-48`). `summary.status`: `null` (never requested / removed), `pending`, `ready`, `failed`; a pending request older than the timeout is reported as `failed` (`Retro::effectiveSummaryStatus`, `app/Models/Retro.php:273-284`). Reopening a completed retro abandons a pending summary (`ChangeRetroPhase.php:54-65`); themes and suggestions already stored remain, which is how `SuggestionsPanel` gets content in `discussing`.

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Generate / Retry / Regenerate summary | buttons in `SummarySection` header: "Generate summary" (status null), "Retry" (failed), "Regenerate" (ready) (`summary-section.tsx:64-95`) | `POST retros/{retro}/summary` `retros.summary.store` → `RetroSummariesController@store` (`:32`), 202 `{status:'pending'}` | `viewer.isFacilitator` only. Server: LLM configured else 404; `RetroGuard::facilitator` + phase `Completed`; 5 requests/min per retro (429); no-op if already pending. Then `ctx.refetch()`. Disclosure for the facilitator when status is null/failed: "The board content is sent to :provider to write the summary." |
| Remove summary | "Remove" ghost button (ready) (`:94-101`) | `DELETE retros/{retro}/summary` `retros.summary.destroy` (`:57`), 204 | Facilitator, completed. Clears summary, themes, pending suggestions and card insights (handled suggestions are kept; `ClearRetroInsights.php:18-38`). Then refetch. |
| Promote a suggested action | "Promote" button on a pending suggestion (`suggestions-list.tsx:154-164`) | `POST retros/{retro}/suggested-actions/{suggestedAction}/promotion` `retros.suggested-actions.promotion.store` → `SuggestedActionPromotionsController@store` (`:27`) → `{suggestedAction, actionItem}` | `canHandle` = `viewer.canHandleSuggestions && (phase==='completed' || isEditable)` (`:28-30`). Server `SuggestionGuard` (`:19-61`): in `discussing` anyone (incl. guests) while the board is unlocked; in `completed` only the facilitator or a workspace Owner/Admin; other phases forbidden; 422 "This suggestion was already handled." Creates an action item carrying the theme (the only way to add an item to a completed retro). Client applies `insights.suggestion` + `actionItem.upsert`. |
| Reject a suggested action | "Reject" ghost button (`:165-174`) | `DELETE retros/{retro}/suggested-actions/{suggestedAction}` `retros.suggested-actions.destroy` → `SuggestedActionsController@destroy` (`:24`) → `{suggestedAction}` | same |
| Jump to the created action item | promoted suggestion rendered as `<a href="#action-item-{id}">` with a check icon, `title="Added to action items"` (`:179-203`) | client-only anchor | all |
| Show dismissed suggestions | native `<details>` "Dismissed (:count)" (`:209-225`) | client-only | all |

Rendering:

- `SuggestionsPanel` (discussing, right column): only when `insights` has at least one theme or suggestion; `<aside aria-label="Suggestions">`.
- `SuggestionsList`: "Themes" (name + its cards' content with `SentimentIcon` and category badge; cards with `content === null` — hidden or GIF-only — are skipped), "Suggested actions" (pending with "Theme: :name", then promoted), "Dismissed". One global `busyId` disables all buttons during a request.
- `SummarySection` (results only): returns null if `results.summary === null`; for non-facilitators also null unless status is `pending`, text is ready, or insights exist (`:26-33`). Pending → `aria-busy` block with `role="status"` "Generating the summary…" and pulsing skeleton lines (`motion-safe`). Ready → text (pre-wrap) + "Generated with :provider". Failed → "The summary could not be generated" (facilitator only). Embeds `SuggestionsList` when insights exist.
- `CardInsight` (`card-insight.tsx:40-58`): sentiment icon (Smile/Meh/Frown, `role="img"` + translated `aria-label` Positive/Neutral/Negative) and category badge above the card text; not for hidden cards.
- `AiSummarySwitch`: checkbox "Automatic AI summary" + explanation naming the provider; used by the settings dialog (sent as `ai_summary_enabled` in `PATCH retros/{retro}/settings`, shown only if `features.llm && features.llmProvider`) and by the team "new retro" dialog (sibling slices).

Realtime: `.insights.changed` and `.results.changed` (both empty payloads; `InsightsChanged.php`, `ResultsChanged.php`) on presence `retro.{id}` → **debounced (1 s) full snapshot refetch** (`use-retro-board.ts:346-348, 139-148`). Fired by summary queue/ready/fail/abandon/remove, suggestion promote/reject (`InsightsChanged`), and delivery status changes.

Asymmetry to keep in mind: a workspace Owner/Admin who is not the facilitator may promote/reject suggestions on a completed retro (`canHandleSuggestions`) but cannot generate/remove the summary (UI keyed on `isFacilitator`, server `RetroGuard::facilitator`).

---

### 6. Results / completed view

Files: `c/retro/results/*`. Shown when `phase === 'completed'`.

**Tabs** (`completed-tabs.tsx`): `role="tablist"` "Retrospective views" with two tabs "Results" / "Board", roving `tabIndex`, ArrowLeft/ArrowRight switch and move focus, `aria-controls="completed-view-panel"`; the active panel has `role="tabpanel"` + `aria-labelledby`. Local state `completedView` defaults to `results` and is **reset to `results` on every phase change** (`board.tsx:85-111`). Client-only.

**`ResultsView`** (`results-view.tsx`), in order:

1. Header: "Retrospective completed on :date" (client-formatted after mount only, to avoid hydration mismatch), `DeliveryLines` for `results.deliveries`, `ResultsShareMenu` (§7).
2. `ParticipantsSection` "Thanks for participating": avatar + name + "Guest" tag for every participant.
3. `SummarySection` (§5).
4. `HealthSection` (only if `results.health`): `HealthRadar` SVG (`role="img"`, `<title>`/`<desc>` listing every statement average; polygon when all statements have answers, otherwise line segments; "No answers" labels), stats (Score x/10, Participation ":respondents / :participants participants", Top strength, Growth area, Alignment value + label), assessment title + sentence (server-provided strings), `HealthTrend` sparkline when `healthTrend` is non-empty (points are plain `<a href={point.url}>` links to earlier retros — full page navigation, not Inertia `<Link>`; hollow point + tooltip note when the statements changed; ":delta since the previous retro"), and the per-statement list with averages. `healthTrend` is `null` for guests (`BuildHealthTrend::forViewer`).
5. "Surveys": `SurveyResult` per `results.surveys` (§1, read-only).
6. `TopTopics`: top 5 top-level cards by votes (`sortByVotes`), group name, content or GIF preview, ":count grouped card(s)", vote count.
7. `ActionItemsResults` (§4, read-only).
8. `GamesPlayedSection` (only if `results.games`): ":count rounds played", `GamesPlayedPodium` (top 3, "Show all"/"Show less" toggle, points, "(guest)"), rounds list (game icon, word/question, outcome badge, leader "Led by :name", winner ":name found it!", clue row, GIF answers with "by :name"/"Anonymous GIF" and "Votes: :count").
9. `RotiSection` "Return on time invested": `RotiControl` (still votable) + average `x/5` and a 1..5 distribution bar list, or "No ratings yet.".

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Switch Results/Board | tabs, arrow keys | client-only | all |
| Replay a drawing round | "Replay" button on `draw` rounds (`games-played-round.tsx:74-82`) → `RoundReplayDialog` (spinner, error text, `DrawingCanvas` replay + word) | `GET games/{room}/rounds/{round}` `games.rounds.show` → `Games\GameRoundsController@show` (`:44`; 404 for active/unfinished rounds); route group middleware `ResolveGamePlayer` | all participants (see Could not verify) |
| Show all / fewer leaderboard rows | podium toggle | client-only | all |
| Open an earlier retro from the trend | SVG point link | plain navigation to `retros.show` of that retro | members |
| Rate ROTI | §3 | §3 | all |
| Promote/reject suggestions, summary buttons | §5 | §5 | facilitator / managers |
| Share | §7 | §7 | sharers |

`results` is only refreshed by snapshot refetch (`replace`); triggers: `phase.changed`, `settings.changed`, `results.changed`, `insights.changed`, `roti.changed` (in completed), and after local ROTI/summary/share actions.

---

### 7. Sharing (link while running, results once completed)

Files: `c/retro/share-board-button.tsx`, `board-post-link.tsx`, `resources/js/components/integrations/share/post-link-section.tsx`, `delivery-lines.tsx`, `results/results-share-menu.tsx`, `recap-share-dialog.tsx`, `email-results-dialog.tsx`, `resources/js/lib/integrations.ts`.

**Who can share** (server, `SharePermissions::retro`, `SharePermissions.php:18-33`): never guests; workspace Owners/Admins; or the facilitator **if they are a member of the team**. For everyone else `integrations` is all-false and `linkDeliveries`/`results.deliveries` are empty, so the whole share UI disappears (`hasShareChannel`). Channels are true only for enabled providers with an active team integration; `email` = `IntegrationAvailability::emailEnabled()`.

| Action | UI element | HTTP / endpoint | Who |
|---|---|---|---|
| Open "Share the board" | header "Share" button → dialog (`share-board-button.tsx`); hidden in `completed` or without any share channel; disabled when `sessionExpired` | client-only | sharers |
| Post the board link to a channel | `PostLinkSection` "Post a link": one outline button per available channel ("Post link to Slack/Telegram/Microsoft Teams/Mattermost", "Send link to webhook"); optional checkbox "Include the guest link (anyone in the channel can join)" only when `retro.guestAccessEnabled` (`post-link-section.tsx`, `board-post-link.tsx:17-39`) | `POST retros/{retro}/shares` `retros.shares.store` → `Integrations\RetroSharesController@store` (`:35`), middleware `throttle:5,1,shares`. Body `{channel, kind:'link', include_guest_link}` → 202 `IntegrationDelivery` | sharers; server: `ensureRetro` (403 "Only the facilitator or a workspace admin can share this retrospective."), channel provider enabled else 404, 422 if completed ("…Share its results instead.") or guest link requested while guest access is off. Toast "The message is on its way." then snapshot refetch. `BoardPostLink` is also embedded in the guest-link dialog (sibling). |
| Delivery status lines | `DeliveryLines` (`aria-live="polite"`): "Sending to :channel…", ":channel: failed — :error" (red), "Sent to :channel · :time", "Emailed to :count people · :time" (relative time only after mount) | none | sharers (data empty otherwise) |
| Open results share menu | "Share" dropdown in the results header (`results-share-menu.tsx`); hidden without any channel and without email | client-only | sharers |
| Share results recap to a channel | menu item "Share to Slack/…/Send to webhook" → `RecapShareDialog`: list of what is included (title/date/participants, card count + ROTI average, the summary if ready, action items with assignees, pending suggested actions, top card per column), warning if the summary is still pending, note on anonymous retros ("Participants are shown as a count. Action items are shown with names."), "Card authors, votes and comments are never shared." → "Send" | `POST retros/{retro}/shares` body `{channel, kind:'results'}` → 202 | sharers; server requires `completed` (422 otherwise). Toast, close, refetch. |
| Email the results | menu item "Send to email" → `EmailResultsDialog`: radio "Participants with an account (:count)" / "All team members (:count)" from `results.emailRecipients`, note "Guests have no account and are never emailed.", "Send" disabled when the chosen count is 0 | `POST retros/{retro}/results-email` `retros.results-email.store` → `Integrations\RetroResultsEmailsController@store` (`:38`). Body `{audience: 'participants'|'team'}` → 202 `IntegrationDelivery` | sharers; server: email enabled else 404, `ensureRetro`, completed, at least one verified-email team member recipient (422 "Nobody can receive these results by email."), **10-minute cooldown per retro** (429 "The results were emailed a few minutes ago."). Toast "The results are on their way.", close, refetch. |

Realtime: delivery progress (queued → sent/failed) arrives as `.results.changed` (`Retro::announceDeliveryChange`, called from `DeliverToChannel` job and the email controller) → debounced snapshot refetch updates `linkDeliveries` / `results.deliveries`. Only the newest delivery per channel is listed (`LatestDeliveries`).

---

### 8. Role / permission-conditional UI — summary

| UI | Flag(s) | Server check |
|---|---|---|
| Add/edit/delete survey, AI draft | `viewer.isFacilitator`, `isEditable`, SurveyPhases | `RetroGuard::facilitator` + `SurveyGuard::activePhase` + `unlocked` |
| Close/reopen survey, toggle voters | `viewer.isFacilitator`, phase ≠ completed | facilitator + `RetroGuard::open` (lock not checked) |
| Answer / withdraw | `isEditable`, `!isClosed`, SurveyPhases | activePhase + unlocked + `SurveyGuard::open` |
| Survey reactions / comments | `resultsVisible`, `isEditable`, SurveyPhases, `retro.reactionsEnabled` (reactions) | activePhase + unlocked + resultsVisible (+ reactionsEnabled) |
| Delete someone else's survey comment | `viewer.isFacilitator` | `guardDeletion` |
| Voter names / text-answer authors | `survey.showVoters` (already false on anonymous retros) | `PresentSurvey` |
| Health check scoring | `isEditable`, phase `health_check` | phase + unlocked |
| Health respondent avatars | `answeredBy` (empty when anonymous) | `PresentHealthProgress` |
| ROTI | phase discussing/completed | phase only |
| Action item manage / complete / comment | `item.isMine`, `viewer.isWorkspaceManager`, `viewer.facilitatedRetroIds`, `viewer.isReviewFacilitator`, assignee match, `isEditable` | `ActionItemPermissions` + `guardDiscussing` |
| Export / retry sync / external link chips | `viewer.userId !== null`, `links.workspace`, `exportSources`, manage | `ActionItemExportGuard`, `RequestActionItemPush` |
| "Manage people" link in export dialog | `viewer.isWorkspaceManager` | `TeamIntegrationsController` (sibling) |
| Carried items panel, action-items page links, health trend, team back link | `!viewer.isGuest`, `links.*` non-null | snapshot builder omits them for guests; `retro-members.{id}` channel auth rejects guests |
| Promote/reject suggestions | `viewer.canHandleSuggestions` (+ `isEditable` in discussing) | `SuggestionGuard` |
| Summary generate/retry/regenerate/remove, provider disclosure, failure text | `viewer.isFacilitator` | facilitator + Completed + LLM configured |
| Share board / share results / email | `integrations.*` (all false unless sharer) | `SharePermissions::ensureRetro` |

### 9. Other state worth preserving

- Local-only storage: `localStorage['skrum.carriedSeen.{retroId}']` (auto-open of the carried sheet once). No other localStorage in this slice.
- Debounces/timeouts: survey refetch 1 s per survey; snapshot refetch 1 s for results/insights/roti bursts; export target search 300 ms; request timeout 15 s (exports 45 s).
- Optimistic updates: health score (`health.answer`), survey reaction (`survey.upsert`). Everything else waits for the response.
- Error surfaces: toast (via `ctx.run`) for almost everything; inline `InputError` in the survey form and AI draft field; inline text in export dialog (targets) and round replay; "Could not load the comments." + Retry in action item comments.
- Toasts (sonner): "Sync requested.", "Exported as :key." + warnings, "The message is on its way.", "The results are on their way.", comment notifications.
- Session expiry: dialogs for survey create/edit/delete are forced closed (`open && !ctx.sessionExpired`), Share buttons disabled, whole board `inert`.
- Empty states: "No action items yet.", "No comments yet.", "No answers yet.", "No ratings yet.", "No answers" (radar), "No project found." / "No repository found.".
- A11y: radiogroup/radio for health scores, `aria-pressed` on ROTI/single-choice/reaction buttons, `aria-expanded` on comment toggles, `aria-live` delivery lines, `role="status"` + `aria-busy` summary skeleton, labelled SVG charts, tablist with arrow keys, `sr-only` legends/labels, sub-task reordering via buttons (keyboard-accessible, no DnD).
- Plural handling is done by choosing between two translation keys in JS (e.g. `'1 response'` vs `':count responses'`, `':count rating'` vs `':count ratings'`).
- Date formatting: due dates formatted in UTC to keep the picked day (`lib/action-items/format.ts:5-13`); relative times computed only after mount/tooltip open.

## Slice notes

**JSON (non-Inertia) endpoints called by this slice** (all through `retroRequest`):

- `GET retros/{retro}/snapshot` (refetch/rollback, shared with the core slice)
- Surveys: `POST retros/{retro}/surveys`, `GET|PATCH|DELETE retros/{retro}/surveys/{survey}`, `PUT|DELETE …/surveys/{survey}/closure`, `PUT|DELETE …/surveys/{survey}/response`, `PUT|DELETE …/surveys/{survey}/reactions`, `POST …/surveys/{survey}/comments`, `PATCH|DELETE retros/{retro}/survey-comments/{surveyComment}`, `POST retros/{retro}/survey-drafts`
- Health: `PUT|DELETE retros/{retro}/health-check/{statement}`
- ROTI: `PUT|DELETE retros/{retro}/roti`
- Action items (retro): `POST retros/{retro}/action-items`, `PATCH|DELETE …/action-items/{actionItem}`, `GET|POST …/action-items/{actionItem}/comments`, `PATCH|DELETE …/action-item-comments/{actionItemComment}`, `POST …/action-items/{actionItem}/subtasks`, `PATCH|DELETE …/action-item-subtasks/{actionItemSubtask}`, `GET …/action-items/{actionItem}/exports/preview`, `POST …/action-items/{actionItem}/exports`, `POST …/action-items/{actionItem}/external-links/{externalLink}/sync`
- Action items (carried panel, workspace routes): `PATCH|DELETE w/{workspace}/action-items/{actionItem}`, `GET|POST …/comments`, comment and sub-task update/delete, `POST …/subtasks`, `POST …/exports`, `GET …/exports/preview`, `POST …/external-links/{externalLink}/sync`
- Export targets: `GET w/{workspace}/teams/{team}/integrations/{integration}/targets`
- AI: `POST|DELETE retros/{retro}/summary`, `POST retros/{retro}/suggested-actions/{suggestedAction}/promotion`, `DELETE retros/{retro}/suggested-actions/{suggestedAction}`
- Sharing: `POST retros/{retro}/shares`, `POST retros/{retro}/results-email`
- Games replay: `GET games/{room}/rounds/{round}`

**Routes in this area that no front code calls**: none. Every `retros.surveys.*`, `retros.survey-drafts.store`, `retros.survey-comments.*`, `retros.health-check.*`, `retros.roti.*`, `retros.action-items.*`, `retros.summary.*`, `retros.suggested-actions.*`, `retros.shares.store`, `retros.results-email.store` controller is imported from `resources/js` outside the generated folders (checked by grep).

**Server events**: every event relevant to this slice is listened to (`survey.changed`, `survey.deleted`, `survey.discussion.changed`, `own-survey-comment.saved`, `comment.notification`, `health.answered`, `roti.changed`, `insights.changed`, `results.changed`, `action-item.saved/deleted/comments.changed`, `carried-action-item.saved/removed/comments.changed`, `action-item.external-links.changed`). No client whispers are used by these features.

**Dead / unused**: `viewer.canManageActionItems` snapshot field is never read. No unused component found in this slice (all listed files are imported).

**Surprising / easy to lose in a rewrite**:

- Request bodies mix conventions: surveys use camelCase (`optionId`, `optionIds`, `parentCommentId`) but `show_voters` snake_case; action items use snake_case (`due_on`, `assignee_user_id`); shares use `include_guest_link`.
- `PATCH surveys/{survey}` has two behaviours selected by `request->keys() === ['show_voters']`: the voter toggle must send that key **alone**.
- `DELETE …/surveys/{survey}/reactions` carries a JSON body `{emoji}`.
- Survey privacy: results/discussion hidden until the viewer answers or the survey closes; broadcasts carry only counts and the client refetches per viewer.
- After a survey comment mutation the client refetches the whole survey instead of patching.
- Close/reopen survey, the voter toggle and ROTI are not blocked by a locked board (neither client nor server).
- ROTI and suggestion promotion remain available after completion; promotion is the only way to add an action item to a completed retro.
- Action item broadcasts are viewer-less: the reducer must preserve local `isMine`, `externalLinks`, `completedVia`, `commentsRevision`.
- The carried panel talks to workspace endpoints from inside the retro page and listens on a separate members-only private channel.
- Deleting an action item, sub-task or comment has no confirmation; deleting a survey has one.
- Health trend links are raw anchors (full reload).
- In `completed`, `SurveysColumn` is hidden even on the Board tab.
- Non-facilitator workspace admins can handle suggestions but not the summary.
- Hardcoded (untranslated) user-facing strings noticed: channel brand names in `lib/integrations.ts:33-41` (Slack, Telegram, Microsoft Teams, Mattermost — intentional), the `'—'` fallback title in `games-played-round.tsx:53`, and numeric suffixes `/10`, `/5`, `%`. Assessment/alignment labels in the health section come pre-translated from the server.

**Could not verify**:

- Whether a guest participant of the retro passes `ResolveGamePlayer` for `GET games/{room}/rounds/{round}` (round replay); the middleware was not read.
- `GenerateRetroSummary` job internals and the exact pending timeout (`Retro::SummaryPendingTimeoutMinutes`).
- Exact content of the recap/email (`BuildRetroRecap`, `RetroResultsNotification`) versus the bullet list shown in the dialog.
- `ResolveActionItemAssignee` rules (which assignees the server accepts), `CreateActionItem`, `SetActionItemStatus` (recurrence follow-up creation), `DeleteActionItem` — only their callers were read.
- `ExportActionItemRules`, `ListExportTargets`, `PreviewActionItemExport` validation/shape details beyond the TS types.
- `EnsureIntegrationProviderEnabled` and `ResolveRetroParticipant` middleware behaviour (failure status codes).
- `SummarizeHealthCheck` (how `score`, `alignment`, `assessment` are computed) and `BuildGamesPlayed`.
- Behaviour was derived from code reading only; nothing was run in a browser.


---

<!-- part: 03-poker -->

# Slice 03 — Planning poker (`poker/show`, `poker/join`, `poker/estimates`)

Paths are relative to `/Users/aritti/Projects/skrum`. `C/` = `resources/js/components/poker/`. All JSON calls go through `retroRequest()` (`resources/js/lib/retro/api.ts:38`): Inertia `http` client, `Accept: application/json`, `X-Socket-ID` header when Echo is configured (so server `toOthers()` skips the caller), 15 s timeout (-> `RetroRequestError(status 0)`), error message = first validation error, else `message`.

---

## pages/poker/show.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `poker/{game}` | `poker.show` | GET | `Poker\PokerGamesController@show` (`app/Http/Controllers/Poker/PokerGamesController.php:22`) | `web`, `ResolvePokerPlayer` (routes/web.php:455-460), `whereUuid('game')`, `scopeBindings`. **No `auth`** — guests allowed. |

`ResolvePokerPlayer` (`app/Http/Middleware/ResolvePokerPlayer.php:17`) resolves the player via `App\Actions\Poker\ResolvePlayer`:
- logged-in user who `can('view', team)` -> `PokerPlayer::firstOrCreate` (auto-joins, no join page);
- else guest cookie (`GuestCookie::PokerScope`, per game) checked against `guest_secret_hash`, only if `guest_access_enabled`.
- No player + no user + non-JSON request: guest access off -> `redirect()->guest(route('login'))`; guest access on -> sets intended URL and renders Inertia page **`retros/session-ended`** (sibling slice's page, reused here) (`ResolvePokerPlayer.php:46-55`).
- No player otherwise: `401 "Your session has expired."` (no user, no guest cookie) or `403 "You no longer have access to this game."`.

### 2. Props

| Prop | Built by | Shape |
|---|---|---|
| `snapshot` | `App\Actions\Poker\BuildPokerSnapshot::handle` (`app/Actions/Poker/BuildPokerSnapshot.php:80-155`) | see below; TS `PokerSnapshot` in `resources/js/lib/poker/types.ts:169` |
| `deckOptions` | `App\Enums\PokerDeck::options()` (`app/Enums/PokerDeck.php:85`) | `{value,label,cards[]}[]` for Fibonacci, ModifiedFibonacci, Tshirt, PowersOfTwo, Custom; TS `PokerDeckOption` (`resources/js/types/poker.ts:3`) |

Snapshot (same payload returned by `GET poker/{game}/snapshot`):
- `game`: `id, title, deck, deckLabel, cards[], isNumeric, facilitatorPlayerId, guestAccessEnabled, guestUrl (null for guests or when guest access off), endedAt, currentTaskId, tasksCount, estimatedCount, totalPoints (null if deck not numeric), hasVotes, autoReveal, anonymousVotes, cursorsEnabled, reactionsEnabled`
- `me`: `playerId, userId, isGuest, isFacilitator, isSpectator, canVote (= !spectator), canEditTasks (= !guest), canTakeControl (= !guest && !facilitator), canDelete (= facilitator || user canManage workspace), transferCandidates[{userId,name}]` (team members + workspace owners/admins, minus self; only for a non-guest facilitator)
- `players[]`: `id, name, avatarUrl, isGuest, isSpectator` (all players ever joined, join order)
- `tasks[]`: `PresentPokerTask` (`app/Actions/Poker/PresentPokerTask.php:50`): `id, title, description, descriptionHtml (server-rendered Markdown, cached), position, estimate, estimatedAt, roundsCount, external`. `external` is null for manual tasks; for guests **and in broadcasts** only `{source,key,url,isManaged}`; for non-guest snapshot/JSON responses adds `assignee, sourceEstimate, refreshedAt, syncState ('synced'|'pending'|'failed'|'unsupported'|null), syncError, unsupportedReason, status, statusCategory, missing, estimateConflict {sourceEstimate, matchingCard}|null, syncMode`.
- `current`: `null | {taskId, round}`; `round` from `PresentPokerRound` (`app/Actions/Poker/PresentPokerRound.php:38`): `id, number, anonymous, revealedAt, revealReason ('manual'|'everyone_voted'|'timer'), timerEndsAt, version, votesCount, votes[{playerId,value}], myVote, result`. Before reveal `value` is null for everyone but the viewer; in an anonymous round others' values stay null forever (only `result.distribution` exposes them). `result` (`PokerResult`) = `{average, distribution[{value,count}], mode[], consensus, nearestCard}`, only when revealed.
- `links.team` (null for guests), `integrations` (null for guests; else `Record<'jira'|'linear'|'jira_dc'|'github', {connected, canWrite} | null>`, null entry = provider disabled), `share` (`ShareOptions::pokerGame`: 5 booleans slack/telegram/msteams/mattermost/webhook; all false if game ended or viewer may not share), `deliveries[]` (latest `poker_link` deliveries, only for viewers who may share), `serverTime` (UTC ms ISO).

Mismatches / unused:
- PHPDoc of `BuildPokerSnapshot` says `share: {slack, telegram}` (line 62) but the real payload has 5 channels (`ShareOptions.php:16-37`); TS `ShareAvailability` (5 channels) is right.
- PHPDoc says `players[].avatarUrl: ?string`; `HasGuestIdentity::avatarUrl()` returns `string`; TS says `string`. OK in practice.
- Never read by the poker UI: `game.totalPoints`, `game.estimatedCount`, `game.tasksCount` (the pane shows `tasks.length`), `game.currentTaskId` (only written by the reducer), `external.refreshedAt`, `external.syncMode`, `integrations[*].canWrite`.

Shared props read: `locale` (`round-history.tsx:20`, `result-panel.tsx:11`, `delivery-lines.tsx:14`), `locales` + `locale` (`LanguageSwitcher`, guests only), `name` (title template in app.tsx), `translations` (via `useTrans`).

### 3. Layout
None: `resources/js/app.tsx:59-62` returns `null` for `poker/show`. Full-screen (`min-h-dvh`) own chrome; no sidebar. `<Head title={snapshot.game.title}>` (title from the *initial* prop, not the live snapshot).

### 4. User actions

"Fac." = `me.isFacilitator`; "not ended" = `game.endedAt === null`. Unless stated, mutations go through `ctx.run()` (`use-poker-game.ts:270`): on failure -> `toast.error(message)` + snapshot refetch; 401/419 -> session-expired banner instead of toast.

| Action | UI element | HTTP / route | Who |
|---|---|---|---|
| Back to the team | `C/game-header.tsx:56` Link (aria "Back to the team") | Inertia visit `links.team` | non-guests |
| Rename game inline | `C/game-header.tsx:133-190` `TitleEditor` input (max 120). Saves on blur; Enter = blur/save; Escape = cancel/restore; empty or unchanged = restore. Then refetch | `PATCH poker/{game}/settings` `poker.settings.update` `PokerSettingsController@update` `{title}` | Fac., not ended |
| Toggle Watch only / Play (self) | `C/spectator-toggle.tsx:43` (`aria-pressed`) -> refetch | `PUT poker/{game}/players/{player}/spectator` `poker.players.spectator.update` `{spectator}` | every player incl. guests, not ended |
| Make player / Make spectator (other) | `C/spectator-toggle.tsx:72` `PlayerRoleMenu` dropdown ("Player options") on each seat (`players-grid.tsx:106`) and each watcher (`watching-row.tsx:31`) -> refetch | same route | Fac., not ended, not on self |
| Open tasks sheet (mobile) | `C/game.tsx:82` button "Tasks" (`lg:hidden`) -> left `Sheet` | client-only | all |
| Show/Hide tasks pane (desktop) | `C/game.tsx:91` (`aria-pressed`) | client-only state (not persisted) | all |
| Take control | `C/take-control-button.tsx:9` -> refetch | `PUT poker/{game}/facilitator` `poker.facilitator.update` `PokerFacilitatorsController@update` `{user_id: me.userId}` | `me.canTakeControl` (non-guest, non-facilitator). Works on an ended game too (server comment `PokerFacilitatorsController.php:61`) |
| Facilitator menu | `C/game-menu.tsx:75` dropdown (aria "Facilitator menu"); forced closed when `sessionExpired` | — | Fac. or `me.canDelete` |
| Share… -> post link to a channel | `C/game-menu.tsx:88` -> `C/game-share-dialog.tsx` -> `components/integrations/share/post-link-section.tsx` (one button per available channel, checkbox "Include the guest link…" when `guestAccessEnabled`, `DeliveryLines` with `aria-live=polite`); toast "The message is on its way." then refetch | `POST poker/{game}/shares` `poker.shares.store` `Integrations\PokerSharesController@store` `{channel, include_guest_link}` -> 202 delivery; `throttle:5,1,shares` | menu item only if `hasShareChannel(snapshot.share)` => non-guest facilitator or workspace owner/admin, game not ended, at least one channel connected |
| Settings… | `C/game-menu.tsx:100` -> `C/game-settings-dialog.tsx`: title, deck (`DeckFields`), Allow guests, auto-reveal, anonymous votes, live cursors, flying reactions. Sends **only changed keys**; no change = just close. On success refetch + close. Validation errors shown per field (`InputError`) + global message; does **not** use `run()` (no toast, no refetch on failure) | `PATCH poker/{game}/settings` with any of `title, deck, custom_cards[], include_unknown, include_coffee, saved_deck_id, guest_access_enabled, auto_reveal, anonymous_votes, cursors_enabled, reactions_enabled` | Fac., not ended |
| Load team saved decks (on dialog open) | `C/game-settings-dialog.tsx:105-125`; failure silently ignored | `GET poker/{game}/saved-decks` `poker.saved-decks.index` `PokerSavedDecksController@index` -> `[{id,name,cards}]` | Fac. and `!game.hasVotes` |
| Pick deck | `C/deck-fields.tsx:152` radiogroup: built-in decks, "Your team's decks" (saved), Custom (comma-separated input, "Add ?" / "Add ☕" checkboxes). Whole fieldset disabled when `game.hasVotes` with note "The deck can't change once votes exist." "Save this deck for the team as…" exists only with `allowSaveAs` (used by the sibling's new-game dialog, **not** here) | part of settings PATCH | Fac. |
| Guest link… -> toggle Allow guests | `C/game-guest-link-dialog.tsx:76` checkbox -> refetch | `PATCH poker/{game}/settings {guest_access_enabled}` | Fac., not ended |
| Copy guest link (dialog) | `C/game-guest-link-dialog.tsx:98`; readonly input selects on focus; toast "Link copied" / error | client-only `navigator.clipboard` | Fac. |
| Create a new guest link | `C/game-guest-link-dialog.tsx:106` -> refetch (response `{guestUrl}` ignored). Server nulls every guest's secret = signs out all guests | `POST poker/{game}/guest-token` `poker.guest-token.store` `PokerGuestTokensController@store` | Fac., not ended |
| Copy guest link (header icon) | `C/game-header.tsx:83-92` | client-only clipboard | non-guest, non-facilitator, `game.guestUrl !== null` |
| Hand over facilitation… | `C/game-menu.tsx:110` -> `C/transfer-dialog.tsx` Select of `me.transferCandidates`; empty state "No one else can facilitate this game yet." -> refetch + close | `PUT poker/{game}/facilitator {user_id}` | Fac., not ended |
| End game | `C/game-menu.tsx:125` -> confirm dialog (`:157-179`) -> refetch | `PUT poker/{game}/status` `poker.status.update` `PokerStatusesController@update` `{ended: true}` (also clears current task) | Fac. |
| Reopen game | `C/game-menu.tsx:118` (no confirm) -> refetch | same, `{ended: false}` | Fac., game ended |
| Delete game… | `C/game-menu.tsx:136` -> `C/delete-game-dialog.tsx` confirm -> `router.visit(links.team ?? dashboard())` | `DELETE poker/{game}` `poker.destroy` `PokerGamesController@destroy` | `me.canDelete` |
| Hide/Show my cursor | `C/game-header.tsx:106-126` (`aria-pressed`); persisted in `localStorage['skrum.hideMyCursor']` (`useLocalPreference`, key shared with retro + whiteboard boards) | client-only | all, only while `showsPokerCursors(snapshot)` |
| Change language | `C/game-header.tsx:127` `LanguageSwitcher` | `PUT` `LocalesController@update` (Inertia `router.put`) | guests only |
| Presence strip | `components/retro/presence-strip.tsx`: 8 avatars + "+N", tooltip name (+ " · Guest"), Eye badge for spectators; `data-presence-id` is the anchor for reaction origins | — | all |
| Add task | `C/tasks-pane.tsx:192` and empty-table CTA `C/game.tsx:161` -> `C/task-form-dialog.tsx` (title max 200 required; description textarea max 10000; Write/Preview tabs — preview only shows the *saved* `descriptionHtml`, otherwise "Save to preview"). Result applied locally (`task.upsert`) | `POST poker/{game}/tasks` `poker.tasks.store` `PokerTasksController@store` `{title, description}` -> 201 task (max 200 tasks/game) | `me.canEditTasks` (any non-guest), not ended |
| Edit task | `C/task-detail.tsx:76-85` pencil -> same dialog | `PATCH poker/{game}/tasks/{task}` `poker.tasks.update` | `me.canEditTasks`, not ended, `task.external === null` (server `PokerGuard::notManaged`) |
| Delete task | `C/task-detail.tsx:86-95` trash -> confirm dialog (`:129-151`) -> local `task.remove` | `DELETE poker/{game}/tasks/{task}` `poker.tasks.destroy` | Fac., not ended |
| Select current task | `C/tasks-pane.tsx:355` row button -> refetch; closes the mobile sheet | `PUT poker/{game}/current-task` `poker.current-task.update` `PokerCurrentTasksController@update` `{task_id}` | Fac., not ended (rows are plain divs otherwise) |
| Reorder tasks (drag-and-drop) | `C/tasks-pane.tsx:230-260` dnd-kit sortable, grip handle "Drag to reorder"; Pointer sensor (6 px) + Keyboard sensor; SR instructions + announcements translated (`:135-149`, `:236-240`). **Optimistic** `tasks.reorder`, rolled back by the refetch in `run()` on failure | `PUT poker/{game}/task-order` `poker.task-order.update` `PokerTaskOrdersController@update` `{task_ids[]}` (must be the full current set, else 422 "The list of tasks is out of date.") | Fac., not ended |
| Import tasks | `C/tasks-pane.tsx:182` -> `C/import-tasks-dialog.tsx` (see next rows) | — | `me.canEditTasks`, not ended, ≥1 connected tracker (`connectedTrackers(snapshot.integrations)`) |
| Import: choose source | `import-tasks-dialog.tsx:390-404` ToggleGroup (only if >1 tracker); resets everything | client-only | idem |
| Import: mode Iteration / Query | `:406-426`; labels per source: Jira/Jira DC Board+Sprint, GitHub Repository+Milestone, Linear Team+Cycle (`:68-104`) | client-only | idem |
| Import: search containers | `:175-205` input, **300 ms debounce**, stale-response guard; runs in iteration mode and (GitHub only) in query mode | `GET poker/{game}/imports/{source}/containers?q=&page=1` `poker.imports.containers.index` -> `{containers[{id,name}], hasMore}` | idem (server rate limit `TrackerBrowseLimit`) |
| Import: choose container -> load iterations | `:223-250`, request-id guard | `GET poker/{game}/imports/{source}/iterations?container=` `poker.imports.iterations.index` -> `[{id,name,state,startsOn,endsOn}]`; option label "name · Active/Upcoming"; empty text per source | idem |
| Import: Show issues | `:252-295` form submit; iteration mode `{mode, iteration_id}`; query mode `{mode, query (max 1000), container (GitHub only, required)}` | `POST poker/{game}/imports/{source}/preview` `poker.imports.preview.store` -> `{issues[{externalId,key,title,assignee,estimate,status,alreadyImported}], truncated}`; "Showing the first 100. Narrow the query." when truncated; "No issues found." | idem |
| Import: select issues / Select all | `:515-573`; already-imported rows checked + disabled with badge; everything else pre-selected | client-only | idem |
| Import: Import N tasks | `:328-354`; toast ":imported imported, :skipped skipped." -> refetch + close | `POST poker/{game}/imports/{source}` `poker.imports.store` `{external_ids[] (1..100)}` -> 201 `{imported, skipped}` | idem |
| Refresh from :source | `C/tasks-pane.tsx:198-220` "More task actions" dropdown, only if an imported task exists for a connected tracker; toasts ":count tasks refreshed." and warning ":count tasks were not found in :source." -> refetch | `POST poker/{game}/imports/refresh` `poker.imports.refresh.store` `Integrations\PokerImportRefreshesController@store` -> `{refreshed, missing}`; `throttle:10,1,poker-refresh` | `me.canEditTasks`, not ended |
| Open issue in tracker | `C/task-source-details.tsx:54` external link (new tab) | — | anyone seeing the current task |
| Sync again / Retry estimate write-back | `C/task-source-details.tsx:98-110`; toast "Sync requested."; local `task.upsert` | `POST poker/{game}/tasks/{task}/sync` `poker.tasks.sync.store` `Integrations\PokerTaskSyncsController@store` -> 202 task | Fac., task has estimate, `syncState` in synced/pending/failed (not `notEnded`-guarded server-side) |
| Resolve estimate conflict: Keep skrum estimate / Use :source estimate | `C/estimate-conflict.tsx:63-78`; "Use source" disabled when `matchingCard === null` + hint ":value is not in this deck."; local `task.upsert` | `POST poker/{game}/tasks/{task}/estimate-conflict` `poker.tasks.estimate-conflict.store` `{resolution: 'keepSkrum'|'useSource'}` (409 if already in sync) | Fac. (non-guest), not ended |
| Expand "Rounds (n)" history | `C/task-detail.tsx:109-121` Collapsible -> `C/round-history.tsx` (Skeleton while loading; "Could not load the rounds."; refetches when `roundsCount`/current round id/`revealedAt` change) | `GET poker/{game}/tasks/{task}/rounds` `poker.tasks.rounds.index` `PokerRoundsController@index` -> rounds, newest first, unrevealed rounds list no voters | every player |
| Play a card / withdraw | `C/hand.tsx:27-70` sticky bottom hand; clicking the selected card withdraws. **Optimistic** `vote.mine`, then reconciled with the response (version-guarded); if `response.revealed` (auto-reveal) -> refetch. Cards disabled while busy, no round, revealed, or ended | `PUT poker/{game}/rounds/{round}/vote` `poker.rounds.vote.update` `{value}` / `DELETE …/vote` `poker.rounds.vote.destroy` (`PokerVotesController`) -> `{roundId, myVote, votesCount, version, revealed}` | `me.canVote` (non-spectators, guests included); spectators see "You're watching — switch to Play to vote" |
| Show votes (reveal) | `C/facilitator-toolbar.tsx:146` (disabled when `votesCount === 0`) -> refetch | `POST poker/{game}/rounds/{round}/reveal` `poker.rounds.reveal.store` `PokerRevealsController@store` | Fac., not ended, round open |
| Timer: 30 s / 1 / 2 / 3 min, Custom minutes… (dialog, 1–60), Stop timer | `C/round-timer-control.tsx:27-147`; local `timer.set` from the response | `PUT poker/{game}/rounds/{round}/timer` `poker.rounds.timer.update` `PokerTimersController@update` `{seconds: int 10..3600 | null}` -> `{timerEndsAt}`; server queues `RevealPokerRoundOnTimer` | Fac., not ended, round open |
| Re-vote | `C/facilitator-toolbar.tsx:156` -> refetch | `POST poker/{game}/tasks/{task}/rounds` `poker.tasks.rounds.store` `PokerRoundsController@store` (201) | Fac., round revealed |
| Choose + Save estimate | `C/facilitator-toolbar.tsx:163-188` Select of non-special cards; default = `task.estimate` ?? suggestion (numeric deck: `result.nearestCard`; else the single mode) ; local `task.upsert` | `PUT poker/{game}/tasks/{task}/estimate` `poker.tasks.estimate.update` `PokerTaskEstimatesController@update` `{value}` (requires a revealed round with a countable vote) | Fac., round revealed |
| Next task | `C/facilitator-toolbar.tsx:191` — next unestimated task after the current one, wrapping (`nextUnestimatedTask`, `lib/poker/game-reducer.ts:34`); disabled when none -> refetch | `PUT poker/{game}/current-task {task_id}` | Fac., not ended |
| Auto-reveal nudge (no UI) | `C/auto-reveal-triggers.tsx`: **2 s debounce**; fires when a presence member leaves and when the countdown hits 0; refetch if `revealed` | `POST poker/{game}/rounds/{round}/auto-reveal` `poker.rounds.auto-reveal.store` (`throttle:30,1`) -> `{revealed}` | only the facilitator's client, `game.autoReveal`, open round (server lets any player call) |
| Send a reaction | `components/realtime/flying-reactions.tsx:106-135` fixed bottom toolbar (`bottom-28` in poker): 6 quick emoji (`👍 ❤️ 👏 🎉 🤔 👎`) + `EmojiPicker` | whisper only (see Realtime) | all incl. guests/spectators, when `reactionsEnabled` and not ended |
| Live cursor | `C/game-cursors.tsx` over `<main>` | whisper only | all, when `showsPokerCursors` and not hidden |
| Session expired -> Reload | `components/retro/session-expired-banner.tsx` (`role=alert`) `window.location.reload()` | — | all |
| Snapshot refetch (no UI) | `use-poker-game.ts:94-135` | `GET poker/{game}/snapshot` `poker.snapshot.show` `PokerSnapshotsController@show` | all |

No polling anywhere; no keyboard shortcuts beyond Enter/Escape in the title editor and dnd-kit keyboard sorting.

### 5. Realtime

Files: `resources/js/hooks/use-poker-channel.ts`, `resources/js/hooks/use-poker-game.ts`, `resources/js/lib/realtime/whisper-transport.ts`, `resources/js/lib/realtime/realtime-state.ts`, `resources/js/components/realtime/{live-cursors,flying-reactions}.tsx`, `useSafeConnectionStatus` from `hooks/use-retro-channel.ts:112`.

**Channel**: one presence channel `echo().join('poker.{gameId}')` = `presence-poker.{gameId}` (`use-poker-channel.ts:85-87`). Auth: `BroadcastAuthorizationsController::authorizePokerChannel` (`app/Http/Controllers/BroadcastAuthorizationsController.php:106-134`) via `ResolvePlayer`; presence user id = **player id**; user info `{id, name, avatarUrl, isGuest}` (= TS `PresenceMember`). Subscribed only while `status === 'active'`; left on unmount.

**Presence**:
- `here` -> `online` (dedup by id: two tabs = one member) + schedule resync.
- `joining` -> add to `online`; if the member is not in `snapshot.players` -> refetch (`use-poker-game.ts:202-213`).
- `leaving` -> remove; calls `onLeaving` -> `Game` increments `departures` -> feeds `AutoRevealTriggers` (`C/game.tsx:33-36`).
- `online` drives: presence strip, seats shown in `PlayersGrid` (online players + offline players who voted, dimmed + "Offline"), `WatchingRow` (online spectators), whisper sender allow-list.
- Server side, `AutoRevealPokerRound` reads the Reverb roster of `presence-poker.{id}` (`app/Support/Poker/ReverbPokerPresenceRoster.php:23`) to decide "everyone voted".

**Server events** (all extend `App\Events\Poker\PokerBroadcastEvent`: `ShouldBroadcastNow`, after commit, on `PresenceChannel("poker.{gameId}")`; listened as `.name`, list in `use-poker-channel.ts:7-16`, handled in `use-poker-game.ts:137-198`):

| `.event` | Class | Payload | Client handling |
|---|---|---|---|
| `.task.saved` | `PokerTaskSaved` | `{task}` (PresentPokerTask **without** sync => reduced `external`) | if `task.external !== null` and viewer is not a guest -> refetch (to get team-only fields); else `task.upsert` |
| `.task.deleted` | `PokerTaskDeleted` | `{taskId}` | `task.remove` (clears `current` if it was the current task) |
| `.tasks.reordered` | `PokerTasksReordered` | `{taskIds[]}` | `tasks.reorder` |
| `.vote.changed` | `PokerVoteChanged` | `{roundId, playerId, hasVoted, votesCount, version}` (never a card value) | if `playerId === me.playerId` (other tab, or facilitator made me spectator) -> refetch; else `vote.changed` (ignored if `version <= round.version`) |
| `.round.changed` | `PokerRoundChanged` | `{}` | refetch |
| `.game.changed` | `PokerGameChanged` | `{}` | refetch |
| `.game.deleted` | `PokerGameDeleted` | `{}` | status `deleted` -> `GameGone` |
| `.timer.changed` | `PokerTimerChanged` | `{roundId, timerEndsAt}` | `timer.set` |

Where they are sent: controllers under `app/Http/Controllers/Poker/**`, actions `AddPokerTask`, `SelectPokerTask`, `RevealPokerRound`, `PlayPokerCard`, `SetPokerEstimate`, `SetPokerSpectator`, `ImportPokerTasks`, `RefreshPokerTasks`, `RequestEstimateSync` (all `sendToOthers()` = `toOthers`, so the actor relies on its HTTP response / own refetch). **Sent to everyone (no `toOthers`)** from background work: `app/Jobs/SyncTaskEstimate.php:164` (`task.saved` after write-back success/failure), `app/Actions/Integrations/ApplyIssueChanges.php:320,329` (inbound tracker webhooks/polling: `task.saved` per task, or one `game.changed` above a threshold), `PokerGame::announceDeliveryChange` (`app/Models/PokerGame.php:111`, `game.changed` when a share delivery changes status), and the timer job via `RevealPokerRound`.

Cross-check: every broadcast event in `app/Events/Poker` is listened to; the front listens to nothing that does not exist. `App\Events\Poker\PokerTaskEstimated` is a non-broadcast domain event (webhook listener only).

**Client whispers** (`whisperTransport`, sender id taken from Reverb's `metadata.user_id`, never the payload; messages from ids not in `online` are dropped; `config/reverb.php:90` `accept_client_events_from = members`):
- `client-cursor` — sent/received by `LiveCursors` through the `live-cursors` npm library (mouse tracked by the library; touch/pen sent manually: `moveMessage(selfId, x, y, {p: pointerType})` throttled 40 ms, `leaveMessage(selfId)` on pointer up, `live-cursors.tsx:116-204`). Coordinates normalised to the `<main>` element. Cursors of members who left are removed. Label = player name (fallback presence name, then "Player").
- `client-reaction` — `FlyingReactions` through the `live-reactions` library; payload has an `e` emoji field validated with `isSingleEmoji`; receive rate limit per sender = token bucket burst 5, 2/s. Origin = sender's avatar in the presence strip (`avatarOrigin`), else near centre.
- Both components are keyed by `gameId:channelKey(presence)` so a swapped Echo channel object rebuilds the transport.

**Gating**: cursors only when `game.cursorsEnabled && !ended && (no current round || round revealed)` (`C/game-cursors.tsx:12` — a pointer over the hand would leak a hidden vote); reactions when `game.reactionsEnabled && !ended`, in every round state.

**Reconnect / resync**: `here` and channel `error` schedule one refetch coalesced over 250 ms (`ResyncCoalesceMs`) — runs on first subscribe and on every re-subscribe. `reconnecting = status === 'failed' || (wasConnected && !connected)` -> `ConnectionBanner` "Reconnecting…" (`role=status`). Root div carries `data-realtime="connecting|connected"` (`realtimeState`: socket connected and `online.length > 0`) — used by the browser test suite.

**Refetch discipline** (`use-poker-game.ts:60-135`): while a refetch is in flight, incoming broadcast actions are buffered and replayed after the `replace`; only the latest refetch wins (`latestRefetch` counter). Refetch errors: 401/419 -> session expired; 404 -> status `deleted`; 403 -> status `ended` (= access lost).

### 6. Role / permission-conditional UI

| Condition (prop) | UI | Server check |
|---|---|---|
| `me.isFacilitator` | title editor, facilitator menu items (Settings/Guest link/Hand over/End/Reopen), task selection + reorder, delete task, facilitator toolbar, timer control, player role menus, sync/conflict buttons, auto-reveal nudges, "Pick a task to start voting" text | `PokerGuard::facilitator` (`app/Actions/Poker/PokerGuard.php:15`) |
| `me.canDelete` (facilitator or workspace owner/admin) | menu visible, "Delete game…" | `PokerGuard::canDelete` |
| `me.canEditTasks` (= not guest) | Add task, Edit task (manual tasks only), Import, Refresh | `PokerGuard::canEditTasks`, `notManaged` |
| `me.canTakeControl` (non-guest non-facilitator) | "Take control" | `PokerFacilitatorsController::ensureTakesControl` |
| `me.canVote` (= not spectator) | hand of cards vs "You're watching" strip | `PokerGuard::canVote` |
| `me.isGuest` | no team link (`links.team` null), no guest URL, `integrations` null, reduced `external`, LanguageSwitcher shown, no copy-link button | snapshot builder; `SharePermissions::pokerGame` |
| `snapshot.share` has a channel | "Share…" | `SharePermissions::ensurePokerGame` (facilitator or workspace manager, non-guest) |
| `game.endedAt !== null` | "Game ended" badge; read-only: no title editor, spectator toggle, add/import/edit/delete, sort/select, toolbar, countdown, cursors, reactions, hand disabled; menu only offers Reopen (+ Delete, Take control still shown) | `PokerGuard::notEnded` everywhere except status, facilitator take-over, delete, sync, rounds index, snapshot |
| `game.hasVotes` | deck fields locked | 422 "The deck can't change once votes exist." |
| `round.revealedAt` | toolbar switches reveal/timer <-> re-vote/estimate; `ResultPanel` shown; hand disabled; cursors allowed | `PokerGuard::openRound` |
| `round.anonymous` | seats stay face-down after reveal (own seat too); `AnonymousValuesRow` shows values without names; history shows distribution only | `PresentPokerRound::visibleValue` |
| `player.isSpectator` | not seated (unless they voted in a revealed non-anonymous round); listed in "Watching" when online; Eye badge in presence strip | — |
| `game.facilitatorPlayerId === player.id` | Crown icon + tooltip on the seat | — |
| header badges | deck label, "Game ended", "Anonymous votes", "Auto-reveal" | — |

### 7. Other state worth preserving

- **Reducer** `gameReducer` (`lib/poker/game-reducer.ts:94`): `replace`, `task.upsert` (re-sorts by `position`, recomputes `tasksCount`/`estimatedCount`), `task.remove`, `tasks.reorder` (unlisted tasks appended), `vote.changed` (version-guarded, voters kept in join order), `vote.mine` (own vote; counts/version only taken when `response.version >= round.version`), `timer.set`.
- **Game status machine** (`use-poker-game.ts:21`): `active` -> `deleted` (event or 404) / `ended` (403). Non-active renders `GameGone`: "This game was deleted." / "Your access to this game has ended." + "Back to the team" when `links.team`. Not to be confused with `game.endedAt` (read-only game, still `active`).
- **Session expiry**: 401/419 on any call -> `SessionExpiredBanner` + the whole game area gets `inert`; facilitator menu dialogs force-closed.
- **Empty states**: no tasks -> "Add the first task" (+ CTA for non-guests) (`C/game.tsx:155-173`) and "No tasks yet." in the pane; no current task -> "Pick a task to start voting" / "Waiting for the facilitator to pick a task"; "No rounds yet."; "No countable votes".
- **Result panel** (`C/result-panel.tsx`): Consensus badge; "Revealed automatically — everyone voted" / "— time's up"; numeric deck: average (1 decimal, locale) + "Nearest card"; otherwise "Most played"; distribution bars.
- **Countdown** (`RoundCountdown` -> `components/retro/timer-display.tsx`): visible to everyone on an open round with a timer; uses `serverOffset` (`useServerOffset(snapshot.serverTime)`), 250 ms tick, `role=timer`, at zero: toast "Time's up!" + 880 Hz WebAudio beep (only if the client saw it running).
- **Cards** (`C/poker-card.tsx`): faces `empty | down | up`; seat aria-label `"{name}: {value | Voted | Not voted yet}"`; hand buttons `aria-pressed`, label "Play :card"; special cards `?` and `☕` excluded from the estimate select.
- **Tasks pane**: source chip with key (+ green check when `statusCategory === 'done'`), estimate badge, "Votes: n" badge on the current row, first description line, `aria-current` on the current row, `data-test="poker-task-row"`.
- **Imported task block** (`C/task-source-details.tsx`): assignee, source estimate, sync badge (Synced/Sync pending/Sync failed/"Not synced: reason"; GitHub tooltip "Written to the issue description."), status badge, "Not found in :source", sync error text, managed-in-source note.
- **Markdown**: `descriptionHtml` injected with `dangerouslySetInnerHTML`, styled by `MarkdownClasses` (`C/task-detail.tsx:30`).
- a11y: `role=toolbar` (facilitator tools, reactions), `role=group` hand "Your cards", `section aria-label` Players/Watching/Anonymous votes, radiogroup for decks, `role=tablist` Write/Preview, `role=alert` import error, dnd-kit live announcements.
- Hardcoded (untranslated) strings: tracker brand names in `TrackerLabels` (`lib/poker/types.ts:87`), deck placeholder `"1, 2, 3, 5, 8"` (`deck-fields.tsx:240`), `' & '` joiner (`tasks-pane.tsx:73`), `'—'` and `'×'` glyphs, name/value concatenation in the seat aria-label (`players-grid.tsx:82`).

---

## pages/poker/join.tsx

### 1. Routes
| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `poker/join/{guestToken}` | `poker.join.show` | GET | `PokerJoinsController@show` (`app/Http/Controllers/PokerJoinsController.php:27`; invalid link render at `:74` with **HTTP 404**) | `web` only |
| `poker/join/{guestToken}` | `poker.join.store` | POST | `PokerJoinsController@store` (re-renders the invalid page at `:74` if the token died) | `throttle:10,1` |

Both redirect to `poker.show` when `ResolvePlayer` already finds a player (team member, or a valid guest cookie).

### 2. Props
Discriminated union, matches TS `Props` (`join.tsx:11-18`):
- `{isInvalid: true}` (token unknown or guest access off), or
- `{isInvalid: false, guestToken: string, gameTitle: string, suggestedName: ?string}` (`suggestedName` = logged-in user's name, e.g. a user outside the team).

No mismatch. Shared props: `translations`, `name`.

### 3. Layout
`AuthLayout` (`resources/js/app.tsx:54-57`).

### 4. User actions
| Action | UI | HTTP | Who |
|---|---|---|---|
| Join | `join.tsx:43-78` Inertia `<Form {...PokerJoinsController.store.form(guestToken)}>`: `name` (required, max 50, autofocus, default `suggestedName`), checkbox `spectator` (value `1`) "Join as spectator"; button disabled while processing; `errors.name` shown | `POST poker/join/{guestToken}`; validates `name` required/string/max 50, `spectator` boolean; creates a guest `PokerPlayer`, sets the guest cookie, redirects to `poker.show` | anyone with a valid link |

### 5. Realtime
None.

### 6. Conditional UI
`isInvalid` -> heading "Join a planning poker game" + "This guest link is no longer valid." (no form).

### 7. Other
Head title = game title (valid) or "Join a planning poker game". No explicit throttle (429) UI.

---

## pages/poker/estimates.tsx

### 1. Routes
| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/teams/{team}/estimates` | `teams.estimates.index` | GET | `TeamEstimatesController@index` (`app/Http/Controllers/TeamEstimatesController.php:50`) | `auth`, `verified`, `can:view,workspace`, `RememberCurrentWorkspace`, `scopeBindings` (routes/web.php:228) + `Gate::authorize('view', $team)` |

Query params: `game` (uuid of one of the team's games, otherwise ignored), `q` (trimmed, `ilike %q%` on task title, wildcard-escaped), `page`. Linked from the team page (`resources/js/components/teams/poker-games-section.tsx:52`, sibling slice).

### 2. Props
| Prop | Built | Shape |
|---|---|---|
| `workspace` | `:51` | `{id, name, slug}` |
| `team` | `:52` | `{id, name}` |
| `games` | `:53` | `{id, title}[]`, newest first (all team games, for the filter) |
| `filters` | `:54` | `{game: ?string, q: string}` |
| `tasks` | `presentRow` `:77-101` | `EstimatedTaskRow[]`: `id, title, gameId, gameTitle, estimate, roundsCount, estimatedAt, rounds[] (PresentPokerRound, revealed rounds only, newest first, viewer = the user's player in that game if any), players[{id,name}]` (only players who voted) |
| `pagination` | `:56-60` | `{currentPage, lastPage, total}`; 50 per page, ordered by `estimated_at desc, id` |

Mismatches: TS `EstimatedTaskRow.estimate: string` / `estimatedAt: string` vs PHPDoc `?string` (non-null in practice because of `whereNotNull('estimated_at')`). `roundsCount` counts **all** rounds while `rounds[]` only holds revealed ones. `pagination.total`, `gameId` and `workspace.id/name` are unused by the page. No export feature exists.

Shared props read: `locale` (`estimates.tsx:52`, date + average formatting).

### 3. Layout
Default `AppLayout` (`resources/js/app.tsx:69-70`).

### 4. User actions
| Action | UI | HTTP | Who |
|---|---|---|---|
| Back to the team | `estimates.tsx:89` Link | `GET teams.show` (`TeamsController.show`) | team viewers |
| Filter by game | `:97-116` Select ("All games" + games) | `router.get(teams.estimates.index ?game&q)` with `preserveState: true, replace: true`; resets page | idem |
| Search tasks | `:117-128` form (submit only, no debounce) | same, `?q=` | idem |
| Expand/collapse a task's rounds | `:166-192` chevron button (`aria-expanded`, "Show rounds"/"Hide rounds"); one row open at a time | client-only | idem |
| Previous / Next page | `:237-268` Links with `preserveScroll`; "Page :page of :total"; shown only if `lastPage > 1` | `GET …?page=n` (page param omitted for page 1) | idem |

### 5. Realtime
None.

### 6. Conditional UI
Anonymous rounds show "Anonymous votes" instead of per-player votes (`:294-298`); voters no longer in `players` show "Former member". No role-dependent UI.

### 7. Other
Empty state "No estimated tasks yet." (also used for an empty filter result). Round result line: distribution `value × count`, Average (locale, 1 decimal) or "Most played: …" or "No countable votes", "Consensus" badge. Date via `Intl.DateTimeFormat(locale, {dateStyle: 'medium'})`. The search input state is not re-synced from `filters.q` after navigation (initial `useState` only).

---

## Slice notes

**JSON (non-Inertia) endpoints called by the front** (all under `poker/{game}`, `ResolvePokerPlayer`): `GET snapshot`; `POST tasks`, `PATCH|DELETE tasks/{task}`; `PUT task-order`; `PUT current-task`; `PUT|DELETE rounds/{round}/vote`; `POST rounds/{round}/reveal`; `POST rounds/{round}/auto-reveal`; `PUT rounds/{round}/timer`; `POST|GET tasks/{task}/rounds`; `PUT tasks/{task}/estimate`; `POST tasks/{task}/sync`; `POST tasks/{task}/estimate-conflict`; `PATCH settings`; `GET saved-decks`; `PUT status`; `POST guest-token`; `POST shares`; `GET imports/{source}/containers`; `GET imports/{source}/iterations`; `POST imports/{source}/preview`; `POST imports/refresh`; `POST imports/{source}`; `PUT facilitator`; `PUT players/{player}/spectator`; `DELETE /` (204). Plus `POST` broadcasting auth (`BroadcastAuthorizationsController.store`, custom handler in `app.tsx:20-37`) and `PUT` locale (Inertia) for guests.

**Routes in this area with no front caller**: none — every `poker.*` route and `teams.estimates.index` is used. Server capabilities the UI never exercises:
- `PUT current-task` accepts `task_id: null` (deselect) — no UI.
- `PUT tasks/{task}/estimate` accepts `value: null` (clear an estimate) — no UI.
- `containers?page=` and the returned `hasMore` — the UI always sends `page: 1` and ignores `hasMore` (no pagination of boards/repos/teams).
- `save_deck_as` in settings (the `allowSaveAs` field is never enabled in the settings dialog; whether `PATCH settings` even honours it was not checked).
- Response bodies ignored in favour of a refetch: reveal, new round, guest-token `{guestUrl}`.

**Owned by a sibling, only mentioned**: game creation `POST w/{workspace}/teams/{team}/poker-games` (`components/teams/new-poker-game-dialog.tsx`), saved decks CRUD `teams.pokerDecks.*` (`components/teams/saved-decks-dialog.tsx`), games list + link to estimates (`components/teams/poker-games-section.tsx`). They reuse `C/deck-fields.tsx` (`DeckFields`, `emptyDeckChoice`, `deckPayload`, `allowSaveAs`) and `lib/poker/format.ts::formatPoints`.

**Shared with other slices (do not break)**: `components/retro/{connection-banner,session-expired-banner,presence-strip,timer-display,emoji-picker,live-cursor-layer (HideMyCursorKey)}`, `lib/retro/api.ts`, `lib/retro/emoji.ts`, `hooks/use-countdown.ts`, `hooks/use-local-preference.ts`, `hooks/use-retro-channel.ts::useSafeConnectionStatus`, `components/integrations/share/{post-link-section,delivery-lines}`, `components/language-switcher.tsx`, page `retros/session-ended` (rendered by the poker middleware). `components/realtime/*` and `lib/realtime/*` are also used by retro/whiteboard boards.

**Dead / unused**: no poker component, hook or lib export is unimported (all 33 components have at least one importer). `types/poker.ts` also holds whiteboard types (`WhiteboardSummary`, `WhiteboardPreview*`, `WhiteboardGalleryItem`, `WhiteboardTemplateSummary`) — misplaced, not dead.

**Surprising**:
- `GameStatus 'ended'` means "access lost (403)", unrelated to `game.endedAt`.
- The settings dialog bypasses `run()` (inline errors, no toast/refetch) unlike every other mutation.
- Broadcast `task.saved` payloads are deliberately the guest-level view; non-guest clients refetch for imported tasks. JSON responses to the actor carry the full view.
- Auto-reveal depends on the facilitator's browser being open for the "someone left" case (plus the queued timer job and each vote/spectator change on the server).
- Guests can toggle their own spectator status and send cursors/reactions; they cannot add tasks.
- `Take control` and `Delete` stay available on an ended game; `Sync again` is not `notEnded`-guarded server-side.
- Unauthenticated visit to a guest-enabled game renders `retros/session-ended` rather than redirecting.
- `<Head>` title and `TitleEditor` key use different sources: the tab title does not follow a live rename.
- Stale PHPDoc for `share` in `BuildPokerSnapshot`.

**Could not verify**:
- Exact wire payloads of `client-cursor` / `client-reaction` whispers (built inside the `live-cursors` / `live-reactions` npm packages; only the `e` field of reactions and `moveMessage/leaveMessage` call sites were seen).
- Whether every `t()` key used here exists in all `lang/*.json` files (not checked).
- `retros/session-ended` page content and `EmojiPicker` internals (sibling slice).
- `TrackerBrowseLimit` thresholds and the 429 UX for import browsing / share / refresh throttles (the front just shows the server message through `handleError`/toast).
- MCP tools reuse of the same actions/events (not read).
- `PokerDeckRules` validation details for custom decks (card count/length limits) and `SavedPokerDeckRules`.
- Whether `snapshot.players[].isGuest` is read anywhere in the poker UI (the "Guest" tooltip comes from the presence member, not the snapshot).


---

<!-- part: 04-games -->

# Slice 04 — Games (team game rooms, guest join, game room, icebreaker reuse)

Paths are relative to `/Users/aritti/Projects/skrum`. `c/games/x.tsx` = `resources/js/components/games/x.tsx`.

All JSON calls in the room go through `retroRequest()` (`resources/js/lib/retro/api.ts:38-78`): Inertia's `http` client, `Accept: application/json`, **`X-Socket-ID` header = `echo().socketId()`** (so server `sendToOthers()` skips the sender), 15 s `AbortSignal.timeout`, errors normalised to `RetroRequestError(status, message, errors)` where message = first validation error ?? `message` ?? http message; timeout ⇒ status `0`. A rewrite must keep the socket-id header, otherwise every mutating client receives its own broadcast as well as applying its HTTP response.

---

## pages/games/index.tsx

### 1. Routes
| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `w/{workspace}/teams/{team}/games` | `teams.games.index` | GET | `TeamGameRoomsController@index` (`app/Http/Controllers/TeamGameRoomsController.php:30` `Inertia::render('games/index')`) | `auth`, `verified`, `can:view,workspace`, `RememberCurrentWorkspace`, scoped bindings (`routes/web.php:196,214-217,232`); `Gate::authorize('view', $team)` (:25) |
| same URI | `teams.games.store` | POST | `TeamGameRoomsController@store` (:42-61) → redirect `games.show` | same; `Gate::authorize('createGameRoom', $team)` (= `TeamPolicy::view`, `app/Policies/TeamPolicy.php:55-58`) |

Entry point: "Games" link on `resources/js/pages/teams/show.tsx:121`.

### 2. Props (`TeamGameRoomsController.php:30-39` vs `pages/games/index.tsx:18-27`)
| Prop | Shape | Built by | TS |
|---|---|---|---|
| `workspace` | `{id,name,slug}` | `$workspace->only()` :31 | `WorkspaceSummary` OK |
| `team` | `{id,name}` | :32 | `TeamSummary` OK |
| `rooms` | `GameRoomSummary[]`: `{id,name:?string,game,gameLabel,access:'team'\|'link',playersCount,roundsCount,updatedAt:?string}` | `PresentGameRoomSummary` (`app/Actions/Games/PresentGameRoomSummary.php:34-46`); query = team rooms with `retro_id IS NULL` (icebreaker rooms excluded), `latest('updated_at')`; `roundsCount` = **ended** rounds only (:18) | `resources/js/types/games.ts:3-12` OK. `updatedAt` is sent but never rendered. |
| `gameOptions` | `{value:GameKind,label,available}[]` for all 4 kinds | `GameRulesRegistry::options(new GameRoom(team))` :34 (`app/Support/Games/GameRulesRegistry.php:42-49`); `gif` available only if a GIF provider is configured | `GameOption` OK |
| `canCreate` | bool = `can('createGameRoom')` && rooms < 10 | :35 | OK |
| `roomLimit` | `10` (`GameRoom::MaxRoomsPerTeam`) | :36 | OK |
| `period` | `'30d'\|'all'` from `?period=`, default `30d` | `TeamGameLeaderboard::period()` | OK |
| `leaderboard` | **deferred** (`Inertia::defer(..., 'leaderboard', true)` :38), `TeamGameLeaderboardRow[]`: `{userId,name,avatarUrl,points,wins,roundsPlayed,streak}`, max 20 rows, team members only | `app/Actions/Games/TeamGameLeaderboard.php:40-73` | optional prop, OK |

Shared props read: none directly (only via `AppLayout`).

### 3. Layout
Default `AppLayout` (`resources/js/app.tsx:48-69`, default branch).

### 4. User actions
| Action | UI | HTTP | Who |
|---|---|---|---|
| Open "New room" dialog | `c/games/new-room-dialog.tsx:43-53` (form is only mounted while open ⇒ state resets) | client-only | `canCreate` (`pages/games/index.tsx:53`) |
| Create room: name (required, maxLength 60, autofocus), "First game" select (only `available` options, default = first available), "Who can join" select (`team` default / `link`) | `new-room-dialog.tsx:64-80`, Inertia `useForm().submit()` | `POST w/{workspace}/teams/{team}/games` `teams.games.store` → redirect to `games/{room}`. Validation `name required max:60`, `game` enum, `access` enum (`TeamGameRoomsController.php:46-50`); server errors: "This team already has 10 game rooms." on `name`, "This game is not available." on `game` (`CreateGameRoom.php:26-42`). `InputError` for name/game/access. Submit disabled while `processing` or no game. Creator becomes host player; room locale = current app locale. | any team viewer |
| Cancel | `new-room-dialog.tsx:147` | client-only | — |
| Back to the team | `pages/games/index.tsx:60-69` `<Link>` | GET `teams.show` (`TeamsController.show`) | all |
| Open a room | `c/games/room-card.tsx:12-37` `<Link>` | GET `games/{room}` `games.show` | all |
| Switch leaderboard period (30 days / all time) | `c/games/team-leaderboard.tsx:38-52` ToggleGroup | `router.reload({data:{period}, only:['period','leaderboard']})` (:26-29) — partial reload of same GET | all |
| Retry leaderboard after deferred failure | `team-leaderboard.tsx:60-68` (`<Deferred rescue>`) | `router.reload({only:['leaderboard']})` | all |

### 5. Realtime
None.

### 6. Conditional UI
- `canCreate` → "New room" button; otherwise, if `rooms.length >= roomLimit`, text "This team already has :count game rooms." (`index.tsx:53-77`).
- Room card: `access === 'link'` → Globe "Open by link", else Users "Team only" (`room-card.tsx:19-29`).
- Leaderboard streak badge (flame, ":count-week streak") only when `streak >= 2` (`team-leaderboard.tsx:16,117-122`); wins/rounds column hidden below `sm`.

### 7. Other state
- Empty states: "No game rooms yet." (`index.tsx:81-85`), "No games played yet." (`team-leaderboard.tsx:91-97`).
- Deferred leaderboard: 3 pulsing skeleton rows fallback (`team-leaderboard.tsx:78-86`), rescue text "Could not load the leaderboard." + "Try again".
- `aria-labelledby="team-leaderboard"`, ToggleGroup `aria-label="Period"`.

---

## pages/games/join.tsx

### 1. Routes
| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `play/{guestToken}` | `games.join.show` | GET | `GameJoinsController@show` (`app/Http/Controllers/GameJoinsController.php:29` render; `:76` invalid render with **HTTP 404**) | web only, no auth (`routes/web.php:516`) |
| `play/{guestToken}` | `games.join.store` | POST | `GameJoinsController@store` (:38-63) | `throttle:10,1,game-join` (`web.php:517`) |

Behaviour: room looked up by `guest_token` + `access = link` + `retro_id IS NULL` (:65-72). If the requester already resolves to a player (logged-in user who can view the team — a `GamePlayer` is auto-created by `FindGamePlayer` — or a valid guest cookie) both GET and POST redirect to `games.show` (:25-27, :46-48). POST creates a guest player (`guest_name`, hashed secret), sets the guest cookie (`GuestCookie::GameScope`, room id) and redirects to `games.show`.

### 2. Props
Invalid: `{ isInvalid: true }` (:76). Valid (:29-35): `isInvalid:false`, `guestToken:string`, `roomName:?string`, `gameLabel:string` (`GameKind::label()`, translated), `suggestedName:string` (`GuestNames::random(locale)`). Matches the TS union (`join.tsx:10-18`).

### 3. Layout
`AuthLayout` (`app.tsx:55-57`).

### 4. User actions
| Action | UI | HTTP | Who |
|---|---|---|---|
| Join with a display name (required, maxLength 50, autofocus, prefilled with `suggestedName`) | `join.tsx:46-71` Inertia `<Form {...GameJoinsController.store.form(guestToken)}>` | `POST play/{guestToken}`; validation `name required string max:50`; `InputError errors.name`; button disabled while `processing` | anyone with the link |

### 5–7
No realtime. Invalid-link state: heading "Join a game" + "This guest link is no longer valid." (`join.tsx:23-33`). Head title = room name or "Join a game". No language switcher on this page itself (could be in AuthLayout — not checked).

---

## pages/games/show.tsx

14 lines: `<Head title={snapshot.room.name ?? ''}/>` + `<GameRoom snapshot/>` (`c/games/game-room.tsx`).

### 1. Routes
| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `games/{room}` | `games.show` | GET | `Games\GameRoomsController@show` (`app/Http/Controllers/Games/GameRoomsController.php:28`) | `whereUuid('room')`, `ResolveGamePlayer`, `scopeBindings` (`routes/web.php:519-523`). **No `auth` middleware**: guests allowed via cookie. |

- An icebreaker room (`retro_id !== null`) redirects to `retros.show` (:24-26): the standalone page never renders an icebreaker.
- `ResolveGamePlayer` (`app/Http/Middleware/ResolveGamePlayer.php:22-45`): resolves the player via `FindGamePlayer` (team member ⇒ `firstOrCreate` player; else guest cookie on `link` rooms; icebreaker ⇒ retro participant). No player + no user + HTML request ⇒ team-only/icebreaker rooms redirect to `login` (guest intended URL), link rooms render Inertia page **`retros/session-ended`** with intended URL set (:60-69). JSON requests: `401 "Your session has expired."` if no user and no guest cookie, else `403 "You no longer have access to this room."`. On every request it also lazily expires a timed-out round (`ExpireGameRound`, :42).

### 2. Props
Single prop `snapshot: GameSnapshot` from `BuildGameSnapshot::handle($room, $player)` (`app/Actions/Games/BuildGameSnapshot.php:58-111`); TS `resources/js/lib/games/types.ts:238-252`. The same shape is returned by `GET games/{room}/snapshot` and embedded as `board.icebreaker` in the retro board snapshot.

| Key | Shape / notes |
|---|---|
| `room` | `{id, name:?string, game, locale, access, timerEndsAt:?ISO (retro timer for icebreakers), isHost, canManage (host \|\| creator \|\| workspace owner/admin), canDelete (standalone && non-guest && (creator \|\| ws admin)), canBecomeHost (standalone && !isHost && same takeover right), hostPlayerId, guestUrl (only standalone + manager + access=link, else null), isIcebreaker, currentRoundId, teamName (null for guests)}` (:71-87) |
| `me` | `{playerId, userId:?string, isGuest}`. `userId` is never read by the front. |
| `players` | `{id, presenceId, name, avatarUrl, isGuest}[]` in join order (`players()` ordered oldest, `GameRoom.php:83-86`); `presenceId` = participant id for icebreaker players, else player id (`GamePlayer.php:103-106`). All players ever joined, not only online. |
| `games` | `GameOption[]` for all 4 kinds |
| `round` | `null` or active round: base `{id, game, leaderPlayerId, startedAt, revealedAt}` (`PresentGameRound.php:23-30`) + per game: **hangman** `{mask, misses, maxMisses:6, pickedLetters}` (`HangmanRules.php:99-107`); **draw** `{mask, maxHints, guesses[], drawing: DrawingOp[], word? (leader only)}`; **decoded** same with `clue: string[]` instead of `drawing` (`WordGuessRules.php:69-81`); **gif** `{question, gifProvider:'giphy'\|'tenor'\|null, myAnswer:{id,gif}\|null, answers, voters, myVote}` — before reveal `answers = [{playerId, answered:true}]`, `voters=[]`, `myVote=null`; after reveal `answers=[{id, gif:{id,previewUrl,url}, playerId\|null}]`, `voters = playerId[]`, `myVote = answerId\|null` (`SprintGifRules.php:56-84`). `guesses` = last 50 non-correct, `veryClose:true` only on the viewer's own near misses. |
| `history` | `GameHistoryRound[]` newest first, max 20 (`GameRoom::KeptRounds`): `{id, game, outcome, word, question, leaderPlayerId, leaderName, winnerPlayerId, winnerName, endedAt}` (`PresentGameRoundHistory.php:31-66`) |
| `links` | `{team: url\|null (standalone non-guest), retro: url\|null (icebreaker)}`. `links.retro` is never read by the front. |
| `emojiData` | `{baseUrl:'/emoji-data/<version>', locale}` for the emoji picker |
| `leaderboard` | `{playerId, points, wins, roundsPlayed}[]`, sorted points → wins → name; standalone counts points after `scores_reset_at`, icebreaker counts all (`RoomLeaderboard.php`) |
| `scoresResetAt` | ISO or null. Never read by the front. |
| `share` | `ShareAvailability` (`Record<ShareChannel, boolean>`); all false unless viewer can share (`GameRoomShares.php:62-69`). PHPDoc on the snapshot says `{slack, telegram}` only (`BuildGameSnapshot.php:39`) but the real payload has 5 channels (`GameRoomShares.php:60`). |
| `deliveries` | `IntegrationDelivery[]` (latest `GameRoomLink` deliveries), `[]` unless viewer can share |
| `serverTime` | UTC ISO with ms; used for the clock offset |

Shared props read by mounted components: `locales` (`c/games/room-settings-dialog.tsx:55`), `translations`/`locale` via `useTrans`, plus whatever `LanguageSwitcher` reads.

### 3. Layout
`null` — no layout, full-screen room (`app.tsx:58-62`).

### 4. State model (must be preserved)

`useGameRoom(initial, {subscribe})` (`resources/js/hooks/use-game-room.ts:63-386`), exposed through `RoomProvider`/`useRoom()` (`c/games/room-context.tsx`).

- Reducer state `{snapshot, lastEnded, resyncRequests}` (`resources/js/lib/games/room-reducer.ts`). Actions: `replace`, `round.started`, `round.ended`, `round.patched`, `letter.picked`, `timer.set`, `guess.added`, `drawing.added|undone|cleared`, `question.changed`, `answer.changed`, `round.revealed`, `vote.changed`.
- `isKnownRound` (:62-68): an event for a round that is neither current nor the just-ended one bumps `resyncRequests` ⇒ effect refetches the snapshot (`use-game-room.ts:160-164`). Late events for the just-ended round are dropped.
- `replace` keeps `lastEnded` only if the fresh snapshot has no round and `lastEnded.roundId === room.currentRoundId`; it carries over client-only `committedOpIds` for the same round (:116-131, :138-149).
- `round.ended` (:163-188): idempotent per round id, ignored unless it is the current round; sets `round=null`, stores `lastEnded`, and adds the awarded points to the local leaderboard (`lib/games/leaderboard.ts:21-45`, re-ranked like the server).
- `letter.picked` keeps client-only `recentPicks` (last 5). `guess.added` dedupes by id, keeps last 50. Drawing events carry `count` (length after the change): replay is ignored, a gap requests a resync (:238-287). `answer.changed` is ignored after reveal. `round.revealed` resets `voters`/`myVote`.
- `apply` vs `dispatch` (`use-game-room.ts:89-107`): while a snapshot refetch is in flight, actions sent through `apply` are buffered and replayed after `replace`, so events committed after the snapshot was built are not lost. Broadcast events use `apply`; most HTTP-response patches use `dispatch` directly (draw ops, undo/clear and the timer use `apply`).
- `refetch` (:118-158): `GET games/{room}/snapshot`; latest-wins counter; on error 401/419 ⇒ `sessionExpired`; 404 ⇒ status `deleted`; 403 ⇒ status `ended`.
- `run(promise)` (:349-367): wrapper for every mutation. On failure: 401/419 ⇒ `sessionExpired` silently; otherwise `toast.error(message)` then refetch, returns `undefined`. Messages (`handleError` :313-343): non-HTTP error "Something went wrong. Please try again."; status 0 "The server did not respond in time. Please try again."; 429 "Slow down a little."; else server message.
- `serverOffset` = `serverTime - Date.now()` recomputed per snapshot (`hooks/use-countdown.ts:3-8`).
- Room status: `active | ended | deleted`; once not active the channel subscription is dropped (`use-game-room.ts:305`).

Top-level render (`c/games/game-room.tsx:15-58`): `full` ⇒ `<RoomFull/>`; status ≠ active ⇒ `<RoomGone/>`; else `SessionExpiredBanner` (when expired; content below gets `inert`), `RoomHeader`, `ConnectionBanner` ("Reconnecting…", `role=status`), `GamePanel`. Root has `data-realtime="connecting|connected"` (`lib/realtime/realtime-state.ts`: connected only when socket is up **and** presence `here` returned ≥1 member) — used by the browser e2e suite.

`GamePanel` (`c/games/game-panel.tsx`): main = `GameBoard` when `snapshot.round` else `RoundEndCard`; aside = `RoomSidebar` (winner highlighted when no round is active).

### 5. User actions — room chrome (all games)

| Action | UI | HTTP | Who |
|---|---|---|---|
| Back to the team | `c/games/room-header.tsx:39-47` | GET `links.team` | non-guest, standalone |
| Switch game (Select; shows available games + the current one; unavailable current is disabled) | `c/games/game-switcher.tsx:22-69` | `PUT games/{room}/game` `games.game.update` `GameSwitchesController@update` body `{game}`; 204; then refetch. Mid-round switch **abandons** the round (`SwitchGame.php:42-44`, broadcast `game.round.ended` outcome `abandoned` + `game.room.changed`). No confirmation in the UI. | host (`room.isHost`); server `GameGuard::mutable` + `host`. Non-hosts see a badge with the game label. |
| Set timer 1/2/3/5/10 min | `c/games/room-timer.tsx:72-80` dropdown (`aria-label="Timer"`) | `PUT games/{room}/timer` `games.timer.update` `GameTimersController@update` `{seconds}` (server: `present nullable integer min:10 max:7200`); response `{timerEndsAt}` applied via `apply(timer.set)` | host, standalone only (`canSet = isHost && !isIcebreaker`; server `GameGuard::standalone` ⇒ 404 for icebreakers) |
| Stop timer | `room-timer.tsx:82-87` (disabled when no timer) | same route with `{seconds:null}` | host, standalone |
| Open history drawer; pick a round; Back | `c/games/history-drawer.tsx:23-73` (Sheet right; closing resets selection) | list is `snapshot.history` (client); detail `GET games/{room}/rounds/{round}` `games.rounds.show` (`c/games/round-detail.tsx:25-27`) | everyone |
| Copy guest link | `room-header.tsx:24-35,57-66` | client-only `navigator.clipboard.writeText(room.guestUrl)`; toast "Link copied" / error toast | only when `guestUrl !== null` (manager + link room + standalone) |
| Invite (post link to a chat integration) | `c/games/room-invite-button.tsx` + `room-invite-dialog.tsx` → `components/integrations/share/post-link-section.tsx`: one button per available channel, optional checkbox "Include the guest link…" (only link rooms), hint text, `DeliveryLines` | `POST games/{room}/shares` `games.shares.store` `GameSharesController@store` `{channel, include_guest_link}`; `throttle:5,1,shares`; 202 with the delivery; then refetch; toast "The message is on its way." | shown only if `hasShareChannel(share) \|\| deliveries.length > 0`; disabled when session expired. Server: `GameRoomShares::ensure` (ws owner/admin, or host/creator who is a team member; never guests/icebreakers) |
| Room menu → Room settings | `c/games/room-menu.tsx:82-88` → `room-settings-dialog.tsx`: name (required, max 60), who can join (team/link; warning "Guests in this room lose access." when going link→team), language of words/questions (from shared `locales`) | `PATCH games/{room}` `games.update` `GameRoomsController@update` `{name, access, locale}`; 204; refetch; close | `room.canManage`; server `GameGuard::manager`. (For icebreaker rooms the server only accepts `locale`, but the menu is hidden there.) |
| Room menu → Regenerate guest link | `room-menu.tsx:54-67,89-95` | `POST games/{room}/guest-token` `games.guest-token.store`; response `{guestUrl}`; toast "A new guest link was created. The old one no longer works."; refetch. Server also signs out every current guest. No confirmation. | `canManage && access === 'link'` |
| Room menu → Hand over hosting → pick a player | `room-menu.tsx:96-112` submenu listing non-guest players other than me (online or not) | `PUT games/{room}/host` `games.host.update` `{player_id}`; 204; refetch. Server rejects guests / non team members ("Only a team member can host.") | host |
| Room menu → Become host | `room-menu.tsx:113-119` | same route with my own player id | `room.canBecomeHost` (creator or ws owner/admin, not already host) |
| Room menu → Delete room (confirm dialog) | `room-menu.tsx:120-129` → `c/games/delete-room-dialog.tsx` | `DELETE games/{room}` `games.destroy`; 204; then `router.visit(links.team ?? dashboard)` | `room.canDelete`; server `GameGuard::canDelete` |
| Sidebar tabs Players / Scores | `c/games/room-sidebar.tsx` (`role=tablist/tab/tabpanel`) | client-only | all |
| Reset scores (confirm dialog) | `c/games/room-scores.tsx:64-77` → `reset-scores-dialog.tsx` | `DELETE games/{room}/scores` `games.scores.destroy`; 204; refetch; close. Team leaderboard keeps the points. | `canManage && !isIcebreaker` |
| Language switcher | `room-header.tsx:70` `components/language-switcher.tsx` (`router.put(LocalesController.update)`) | see shared component | guests only (`me.isGuest`) |
| Session expired → Reload | `components/retro/session-expired-banner.tsx` | `window.location.reload()` | — |

Menu visibility: hidden entirely when `isIcebreaker` or no `canManage/canDelete/canBecomeHost` (`room-menu.tsx:35-40`). Dialogs are force-closed when the session expires (:30).

Other chrome: `RoomTimer` badge counts down from `timerEndsAt` with server offset, 250 ms tick, `m:ss`, shows destructive "Time's up" at 0 (`room-timer.tsx:49-56`, `hooks/use-countdown.ts`). `PresenceStrip` shows up to 8 online avatars + "+N". `PlayersList` (`c/games/players-list.tsx`): online players first, offline at 50 % opacity, "(guest)" suffix, crown on `hostPlayerId`, check on the last winner. `RoomScores`: ranked list, "Former member" when the player is unknown, "No points yet.".

### 6. Round lifecycle (common to every game)

1. **No round** → `RoundEndCard` (`c/games/round-end-card.tsx`). First time (no outcome known): "Ready to play?" + `StartRoundControls label="Start"`. Otherwise an end card: outcome badge (`lib/games/outcomes.ts`: Guessed / Solved / Lost / Time's up / Passed / Revealed / Abandoned), the word, the question, GIF results, ":name found it!", points chips (`RoundPoints`, only awards > 0, "+:points :name") and `StartRoundControls label="Next round"`. Data comes from `lastEnded` (live) falling back to the `history` entry whose id is `room.currentRoundId` (after reload). For a GIF round seen after reload it fetches `GET games/{room}/rounds/{round}` to get the answers (:28-58, errors swallowed).
2. **Start** (`c/games/start-round-controls.tsx`): non-host sees "Waiting for the host to start."; host sees "This game is not available." if the room's game is unavailable. For `draw`/`decoded` a `LeaderPicker` select ("Who draws?" / "Who gives the clues?") lists **online** players; default = next online player after the previous leader in join order, wrapping (`lib/games/rotation.ts`), previous leader = `lastEnded.leaderPlayerId ?? history[0].leaderPlayerId`; a manual choice is kept only while that player is online. Fewer than 2 online ⇒ "Waiting for another player" and the button is disabled. Start: `POST games/{room}/rounds` `games.rounds.store` body `{leader_player_id}` (or `{}` for hangman/gif), 201 `{round, ended}`; dispatches `round.ended` (if a previous round was closed by the start — only a revealed GIF round can be, `SprintGifRules::outcomeOnNextRound`) then `round.started`. Server: `GameGuard::mutable` + `host`; 409 "A round is already in progress." otherwise.
3. **Active round** → `GameBoard` (`c/games/game-board.tsx`): the game body + `PassRoundButton` bottom-right. `DrawBoard` and `DecodedBoard` are keyed by round id (tool state and previews reset each round); hangman and gif are not.
4. **Pass / Give up** (`c/games/pass-round-button.tsx`): visible to the host or the round leader; label "Give up" for hangman, "Pass" otherwise; `POST games/{room}/rounds/{round}/pass` `games.rounds.pass.store` → `{ended}`; dispatch `round.ended` + refetch. Outcome `passed`, no confirmation.
5. **Timer expiry**: purely server-side — delayed job `CloseExpiredGameRound` (`ScheduleRoundExpiry.php`) plus lazy expiry on any `games/{room}/*` request. The client only shows "Time's up"; the end arrives as `game.round.ended` (outcome `timed_out`), except GIF before reveal where the timer triggers the reveal instead (`SprintGifRules.php:110-119`).
6. Every `round.ended` received by broadcast also triggers a snapshot refetch (`use-game-room.ts:187-193`) to refresh history/leaderboard; local enders do the same manually.

Errors while a round is stale: 409 "This round is over." etc. → toast + refetch through `run`.

### 7. Game: Hangman (`c/games/hangman-board.tsx`)
- No leader (`leaderPlayerId` null): everyone plays together, including the host.
- UI: `HangmanFigure` SVG (6 body parts scaled to `misses/maxMisses`, `role=img`, aria ":count of :max misses"), text ":count of :max misses", `WordMask` (one cell per character; `null` = hidden, space = gap, `-` and `'` shown as separators; `role=img`, aria ":count letters left to find"), `LetterKeyboard` (26 buttons a–z, grid 7/9/13 columns, picked letters disabled + `aria-pressed`), and a "Last letters" list (most recent first, max 5, green when hit; client-only `recentPicks`, lost on reload).
- Pick a letter: `POST games/{room}/rounds/{round}/letters` `games.rounds.letters.store` `{letter}` (server regex `[A-Za-z]`, token bucket 3 burst / 1 per s per player ⇒ 429 "Slow down a little."; 409 "This letter was already picked."). Whole keyboard disabled while a pick is pending. Response `{roundId, playerId, letter, hit, mask, misses, ended}` → dispatch `letter.picked`, and `round.ended` + refetch if `ended`.
- End: all letters revealed ⇒ `solved` (winner = last picker); 6 misses ⇒ `lost`. Points: 1 per position revealed by your letters, +5 solve bonus (`HangmanRules.php:70-93`).
- Only the host can "Give up".

### 8. Game: Draw & Guess (`c/games/draw-board.tsx`, `drawing-canvas.tsx`, `drawing-toolbar.tsx`, `lib/games/drawing.ts`, `lib/games/stroke-whisper.ts`)
Roles: **drawer** = `round.leaderPlayerId === me.playerId`; everyone else guesses (the host is a guesser unless chosen as drawer).

Drawer UI:
- `LeaderWord` "Your word to draw" (shows `…` until known). The word comes from the snapshot / start response when the viewer is the leader; if the round arrived by broadcast (no word) `useSecretWord` fetches `GET games/{room}/rounds/{round}/secret` `games.rounds.secret.show` → `{word}` (leader only, 403 otherwise) and patches the round (`hooks/use-secret-word.ts`).
- Canvas (`<canvas width=800 height=600>`, CSS `aspect-[4/3] w-full touch-none bg-white`, crosshair cursor, `role=img` label "Your drawing"). Logical coordinates are integers on a **1000 × 750** grid (`pointFromEvent`), rasterised on an 800 × 600 palette-indexed raster (`createRaster/applyOp/replay/paintRaster`) so every client renders identical pixels: strokes are stamped disks along segments, fill is an exact 4-connected scanline flood fill. Incremental apply when the ops array is an append, full replay otherwise (`drawing-canvas.tsx:116-140`).
- Pointer handling (`drawing-canvas.tsx:242-312`): primary mouse button only; single active pointer (second finger ignored); pointer capture; identical consecutive points skipped; pointer up/cancel commits. A stroke reaching `MaxStrokePoints = 400` is committed and a new one begins from the same point. A stroke in progress is dropped when input stops or the round changes.
- Tools (`drawing-toolbar.tsx`, `role=toolbar` "Drawing tools"): 6 colours (black, red, orange, green, blue, purple; white is eraser-only) with `aria-pressed`; picking a colour while on eraser switches back to pen; 3 sizes (4/10/24); Pen / Eraser (white stroke) / Fill; Undo (disabled when no ops); Clear with two-step confirmation ("Clear" → "Click again to clear", auto-cancels after 3 s). Defaults: pen, black, size 10. No keyboard shortcuts.
- `HintButton` "Reveal a letter (:count left)" — `POST games/{room}/rounds/{round}/hints` `games.rounds.hints.store` → `{roundId, mask}`; left = `maxHints − letters shown on the mask` (`lib/games/hints.ts`); `maxHints` = half the word's letters. Each hint lowers the guesser's reward (10 − 2/hint, floor 4).
- Commit a stroke/fill: `POST games/{room}/rounds/{round}/drawing-ops` `games.rounds.drawing-ops.store` body `{client_op_id, op}` → 201 `{roundId, op, clientOpId, count}`. Undo: `DELETE …/drawing-ops/last` → `{roundId, count}`. Clear: `DELETE …/drawing` → `{roundId, count:0}`. All three are chained on a **serial promise queue** so the server keeps the drawer's order (`draw-board.tsx:102-105`), and the drawer applies its own result through `apply` (the broadcast skips the sender). Optimistic: committed-but-unacknowledged strokes are drawn as `pending` previews until the response. Server limits: token bucket 20 burst / 20 per s shared by add/undo/clear; max 500 ops and 20 000 points ("The drawing is full. Clear it to keep drawing."); ≤1000 points per stroke.
- Live strokes: while drawing, every 40 ms (`StrokeWhisperThrottleMs`) the unsent tail is whispered in chunks of ≤100 points, each chunk starting with the previous chunk's last point (see Realtime).

Guesser UI: `WordMask` + ":name is drawing"; read-only canvas ("The drawing") showing committed ops plus remote live previews (not yet in `committedOpIds`; a preview not updated for 3 s is dropped by a 1 s sweeper, `draw-board.tsx:84-100`).

`GuessChat` (`c/games/guess-chat.tsx`, shared with Decoded): list (`aria-live=polite`, auto-scroll to bottom on new entry, "No guesses yet."), each line "Name: text" + "Very close!" badge on the viewer's own near misses. Leader sees "You know the word, so you cannot guess." instead of the form. Form: input maxLength 50, read-only while busy; `POST games/{room}/rounds/{round}/guesses` `games.rounds.guesses.store` `{text}` → `{result:'wrong'|'near'|'correct', guessId, ended}`; on `ended`: dispatch `round.ended`, refetch, toast "You found it!"; else append own guess locally (with `veryClose` if `near`). Server: bucket 3 burst / 1 per s; matching folds accents/case/hyphens/apostrophes, near = Levenshtein ≤1 (≤4 letters) or ≤2 (`GuessMatch.php`). Correct guesses are never broadcast or listed.

End: correct guess ⇒ `guessed` (winner = guesser; drawer +5, winner 10 − 2×hints, min 4); `passed`; `timed_out`; `abandoned`.

### 9. Game: Decoded (`c/games/decoded-board.tsx`, `clue-editor.tsx`, `clue-row.tsx`, `lib/games/clue.ts`)
Same engine as Draw & Guess (leader, mask, hints, guess chat, secret word fetch), with an emoji clue instead of a drawing.
- Clue giver: `LeaderWord` "Your word to describe"; `ClueEditor` with 5 slots: filled slots are buttons that remove that emoji on click (`aria-label="Remove :emoji"`), the next free slot is an `EmojiPicker` (`components/retro/emoji-picker`, fed by `snapshot.emojiData`), remaining slots are dashed placeholders; help text "Describe the word with up to five emoji, without letters or digits.". Letter-like emoji are refused client-side (`isClueEmoji`, toast "Use emoji only, without letters or digits."), mirroring `App\Rules\ClueEmoji`. Each edit patches the round at once (optimistic) and saves the **whole row** after a 300 ms debounce: `PUT games/{room}/rounds/{round}/clue` `games.rounds.clue.update` `{clue: string[]}` (last edit wins; bucket 5 burst / 5 per s). Plus `HintButton`.
- Guessers: ":name is giving clues" + read-only `ClueRow` (`role=img`, aria "Clue: …" / "No clue yet").
- `WordMask` is shown to everyone, leader included.

### 10. Game: Sprint in one GIF (`c/games/sprint-gif-board.tsx`, `gif-question-banner.tsx`, `gif-answer-stage.tsx`, `gif-voting-stage.tsx`, `gif-round-results.tsx`, `gif-tile.tsx`, `game-gif-picker.tsx`, `components/gifs/gif-search-dialog.tsx`, `lib/games/gif.ts`)
No leader. Two stages in one round, driven by `round.revealedAt`.

Stage 1 — answering:
- Question banner. Host only, and only while unrevealed, no answers yet and no own answer: "Shuffle question" (`PUT games/{room}/rounds/{round}/question` `games.rounds.question.update` with `{}` → server picks another) and "Edit question" (inline form, max 200, Save/Cancel, sends `{text}`). Response `{question}` → `question.changed`. Server 409 "The question can no longer be changed." after the first answer.
- Everyone: "Choose a GIF" / "Change GIF" opens `GifSearchDialog` (search input, 300 ms debounce, also runs with an empty query on open; grid of previews; errors "Too many searches, wait a moment." on 429 else "GIF search is unavailable."; "No GIFs found."; footer "Powered by GIPHY|Tenor"). Search: `GET games/{room}/gifs?q=` `games.gifs.index` → `{gifs:[{id,previewUrl,width,height}]}` (20 searches/min per player; 404 when no provider; 403 "GIFs are turned off for this board." on icebreakers of retros with GIFs disabled). Picking: `PUT …/rounds/{round}/answer` `games.rounds.answer.update` `{gif_id}` → `{myAnswer}`; "Remove GIF": `DELETE …/answer` `games.rounds.answer.destroy` (204). Both update `myAnswer` and the pending list locally. Own GIF shown as a tile "Your GIF".
- Other players' answers appear only as placeholders ":name answered" (GIFs stay secret); "No GIFs yet." when nobody answered.
- Host: "Reveal the GIFs" — `POST …/rounds/{round}/reveal` `games.rounds.reveal.store` → the full round as the host sees it, patched in. Timer expiry also reveals.

Stage 2 — voting:
- "Vote for your favourite GIF." + live ":count of :total voted" (`aria-live=polite`; total = max(online members, voters)).
- Grid of revealed GIFs; caption "Your GIF" / "by :name" / "Anonymous GIF" (author hidden on anonymous retros). Each GIF except your own has a toggle "Favourite" / "Your favourite" (`aria-pressed`, highlighted tile): `PUT …/rounds/{round}/vote` `games.rounds.vote.update` `{answer_id}`; clicking the chosen one retracts with `DELETE …/vote` `games.rounds.vote.destroy`. One vote per player, replaceable; only "voted" is broadcast. Bucket 3 burst / 1 per s. Vote counts stay hidden.
- Host: "Finish round" — `POST …/rounds/{round}/close` `games.rounds.close.store` → `{ended}` → `round.ended` + refetch. Outcome `revealed`.

Results (`GifRoundResults` in the end card, history detail): answers sorted by votes desc, caption author or "Anonymous GIF", "Votes: :count" (only when votes is a number — null for passed/abandoned rounds), "+N" badge from the round's points (2 per vote; 0 on anonymous retros).

`GifTile` uses `gif.previewUrl` (proxied `gifs/{gif}/preview` route, never a provider URL); `gif.url` (full size) is sent but not used by these components.

### 11. History detail (`c/games/round-detail.tsx`)
`GET games/{room}/rounds/{round}` → history entry + `presentEnded` fields (404 for active rounds). Spinner while loading, destructive text on error. Shows outcome badge, ":name found it!", "Led by :name", then per game: hangman full mask + "Letters tried: …"; draw replay canvas (read-only `DrawingCanvas`) + word; decoded clue row + word; gif question + results. List rows show `word ?? question ?? '—'` + outcome badge.

### 12. Realtime

Hook: `resources/js/hooks/use-game-channel.ts` (subscription), `use-game-room.ts` (handling), `use-stroke-whispers.ts` + `lib/realtime/whisper-transport.ts` (whispers).

**Channel**: presence `game.{roomId}` (wire name `presence-game.{id}`), joined with `echo().join()` only when `subscribe && status === 'active'` and Echo is configured. Auth: `POST broadcasting/auth` → `BroadcastAuthorizationsController::authorizeGameChannel` (`app/Http/Controllers/BroadcastAuthorizationsController.php:176-213`): 403 for unknown room, icebreaker rooms, or no player; member info `{id: player.id, name, avatarUrl, isGuest}`.

**Presence**: `here` → set online (deduped by id) + schedule resync; `joining` → add; if the member is not in `snapshot.players` (matched on `presenceId`) refetch; `leaving` → remove. `online` drives the header strip, player list ordering, leader picker, start gating and the vote total.

**Resync**: a coalesced (250 ms) snapshot refetch after `here` (initial load and every reconnect) and after any non-403 subscription error. `reconnecting` = status `failed` or (was connected and no longer connected).

**Server events** (all extend `app/Events/Games/GameBroadcastEvent.php`: `ShouldBroadcastNow`, after commit, presence channel `GameRoom::broadcastChannel()`, always dispatched with `sendToOthers()`):

| `.event` | Class | Payload | Client handling (`use-game-room.ts:166-288`) |
|---|---|---|---|
| `game.room.changed` | `GameRoomChanged` | `{}` | refetch (settings, host, guest token, scores reset, game switch, delivery status) |
| `game.room.deleted` | `GameRoomDeleted` | `{}` | status `deleted` → RoomGone |
| `game.timer.changed` | `GameTimerChanged` | `{timerEndsAt}` | `timer.set` |
| `game.round.started` | `GameRoundStarted` | `{round}` public view (never the word, `myAnswer:null`) | `round.started` |
| `game.round.ended` | `GameRoundEnded` | `{roundId, outcome, word, winnerPlayerId, leaderPlayerId, points:[{playerId,points,isWin}], question?, answers?}` (`EndGameRound.php:41-49`) | `round.ended` + refetch |
| `game.letter.picked` | `GameLetterPicked` | `{roundId, playerId, letter, hit, mask, misses}` | `letter.picked` |
| `game.hint.revealed` | `GameHintRevealed` | `{roundId, mask}` | patch mask |
| `game.guess.made` | `GameGuessMade` | `{roundId, guessId, playerId, text}` (wrong/near only, no near flag) | `guess.added` |
| `game.drawing.op-added` | `GameDrawingOpAdded` | `{roundId, op, clientOpId, count}` | `drawing.added` (also records `clientOpId` so the matching live preview disappears) |
| `game.drawing.undone` | `GameDrawingUndone` | `{roundId, count}` | `drawing.undone` |
| `game.drawing.cleared` | `GameDrawingCleared` | `{roundId, count:0}` | `drawing.cleared` |
| `game.clue.changed` | `GameClueChanged` | `{roundId, clue}` | patch clue |
| `game.question.changed` | `GameQuestionChanged` | `{roundId, question}` | `question.changed` |
| `game.answer.changed` | `GameAnswerChanged` | `{roundId, playerId, answered}` (`true` on first answer only, `SetGifAnswer.php:53-55`; `false` on removal, `RemoveGifAnswer.php:28-30`) | `answer.changed` |
| `game.round.revealed` | `GameRoundRevealed` | `{roundId, revealedAt, answers}` | `round.revealed` |
| `game.vote.changed` | `GameVoteChanged` | `{roundId, playerId, voted}` (`true` on first vote only; `false` on retraction, `RetractGifVote.php:28-30`) | `vote.changed` |

Cross-check: the 16 concrete classes in `app/Events/Games/` map one-to-one to the 16 names in `GameEvents` (`use-game-channel.ts:8-25`). No server game event is unheard, no listened name lacks a class.

**Client whisper** `game-stroke` (wire `client-game-stroke`): payload `{v:1, id, color, size, points}` — `id` = `<roundId>-<base36 time><random>` (≤64 chars, pattern `[A-Za-z0-9_-]`), ≤100 points per message, sent by the drawer every 40 ms while a stroke is live. Receivers accept a message only if Reverb's stamped sender id (`metadata.user_id`; `config/reverb.php:90` `accept_client_events_from = members`) equals the current drawer's `presenceId`, the id starts with the active round id, and colour/size/points validate (`stroke-whisper.ts:34-56`). The drawer does not listen (source is `null` for the drawer). Send failures after the channel is left are swallowed.

### 13. Room-full / room-gone / session states
- **Room full** (`c/games/room-full.tsx`): "This room is full." + "Up to 12 players can be online at once." + "Try again" (`window.location.reload()`). Trigger: the presence subscription errors with status 403 (`use-game-channel.ts:54-61,115-123`). Server cap: 12 distinct online presence ids read from Reverb's HTTP API (`ReverbGamePresenceRoster`, 2 s timeout); a player already online may always reconnect; an unreadable roster lets everyone in. The HTTP page itself still loads (the cap is enforced only at channel auth), so the snapshot is fetched but the room is not rendered. The number 12 is hardcoded in the translated string, not taken from the server.
- **Room gone** (`c/games/room-gone.tsx`): `deleted` → "This room was deleted." (from `game.room.deleted` or a 404 snapshot); `ended` → "Your access to this room has ended." (403 snapshot: guest link regenerated, room switched to team-only, member removed). "Back to the team" only when `links.team` exists (never for guests).
- **Session expired**: 401/419 on any call → red `role=alert` banner with "Reload"; the room is made `inert`.
- **Logged-out guest on a link room** (full page load): server renders `retros/session-ended` (other slice).

### 14. Role matrix
| Capability | Flag | Server check |
|---|---|---|
| Start round, switch game, GIF reveal/close, edit question | `room.isHost` | `GameGuard::host` (standalone: `host_player_id`; icebreaker: the retro facilitator, `GameRoom.php:126-134`) |
| Timer | `isHost && !isIcebreaker` | `standalone` + `host` |
| Settings, regenerate link, reset scores, see/copy guest link | `canManage` (host, creator, ws owner/admin) | `GameGuard::manager` (+ `standalone` for token/scores) |
| Delete room, become host | `canDelete` / `canBecomeHost` | creator or ws owner/admin, non-guest, standalone |
| Hand over hosting | host; target must be a non-guest team member | `GameHostsController.php:37-45` |
| Invite via integrations | `share` has a channel or deliveries exist | `GameRoomShares::canShare` |
| Draw, clue, hint, see the word | round leader | `GameGuard::leader` |
| Guess | everyone but the leader | `GameGuard::notLeader` |
| Pass | leader or host | `GameGuard::leaderOrHost` |
| Pick letters, answer, vote | every player incl. guests | round/game guards only |
| Language switcher, no team link, no `teamName` | `me.isGuest` | — |

---

## Icebreaker reuse (retro board, not a page of this slice)

Files: `resources/js/components/retro/icebreaker-stage.tsx`, `icebreaker-game.tsx`, `icebreaker-game-select.tsx`; wiring in `components/retro/board.tsx:271-272`, `hooks/use-retro-board.ts:419-451`, `hooks/use-retro-channel.ts:83-85,~175-179`.

- **When**: `board.retro.phase === 'icebreaker'`. The retro snapshot's `icebreaker` key is a full `GameSnapshot` built for the participant (`app/Actions/Retros/BuildBoardSnapshot.php:308-324`: room created on first need by `EnsureIcebreakerRoom`, one room per retro, game = `retro.icebreaker_game`, locale = facilitator's; expired round closed first; a `GamePlayer` with `participant_id` is `firstOrCreate`d for the viewer). `null` ⇒ spinner (`icebreaker-stage.tsx:12-18`).
- **Channel**: the game does **not** join `presence-game.{id}` (the server refuses it for icebreaker rooms, `BroadcastAuthorizationsController.php:186`). `useGameRoom(snapshot, {subscribe:false})`; `GameBroadcastEvent` broadcasts on `presence-retro.{retroId}` (`GameRoom::broadcastChannel()`, `GameRoom.php:159-166`). `useRetroChannel` registers the same 16 `GameEvents` names on the retro presence channel and forwards them to listeners registered through `board.subscribeGameEvents(room.handleEvent)` (`icebreaker-game.tsx:128-131`); events arriving while the panel is not mounted are dropped.
- **Presence / whispers**: `online` and `presence` come from the retro channel (`ctx.online = board.online`, `ctx.presence = board.presence`). Presence ids are **participant ids**, which is why players carry `presenceId` (= participant id here). Stroke whispers (`client-game-stroke`) travel on the retro channel next to the live cursors (`LiveCursorLayer` is mounted over the stage).
- **HTTP**: identical `games/{room}/…` endpoints; `ResolveGamePlayer`/`FindGamePlayer` resolve the retro participant (guest cookie scope = retro). `GameGuard::mutable` only allows play during the Icebreaker phase and while the board is unlocked ("The game can only be played during the icebreaker.").
- **What differs in the UI**: no `RoomHeader` — a slim bar "Icebreaker" + `GameSwitcher` (host = retro facilitator) or game badge + `HistoryDrawer`; then the same `GamePanel` (boards, end card, start controls, sidebar players/scores). Not mounted: timer control, copy guest link, invite, room menu (also self-hidden by `isIcebreaker`), presence strip, language switcher, RoomFull, RoomGone, connection/session banners (the board owns those; `sessionExpired = board || room`). "Reset scores" hidden (`room-scores.tsx:14`). No 12-player cap. Host follows facilitation transfers automatically. GIF authors hidden and GIF points zeroed on anonymous retros; GIF game available only if `retro.gifs_enabled`.
- **Extra sync logic** (`icebreaker-game.tsx`): (a) `useUnknownPlayerRefetch` — online members or a round leader missing from `snapshot.players` trigger a refetch after 1.5 s, at most 3 attempts per id (other participants' players are created silently on their own board load, no event announces them); (b) `useBoardSnapshotRefetch` — a new board snapshot never replaces the game state, it triggers the room's own buffered refetch; component is keyed by room id; (c) `withBoardTimer` overrides `room.timerEndsAt` with `board.retro.timerEndsAt`.
- **Leaving the phase**: `AbandonIcebreakerRound` ends the active round as `abandoned` inside the phase change.
- `IcebreakerGameSelect` (label "Icebreaker game", shows available options + current value) is used by `components/teams/new-retro-dialog.tsx:383` and `components/retro/settings-dialog.tsx:276` (fields `icebreaker_enabled` / `icebreaker_game`).
- Retro results reuse: `components/retro/results/round-replay-dialog.tsx` calls `GET games/{room}/rounds/{round}` and renders a read-only `DrawingCanvas`.

---

## Slice notes

### JSON (non-Inertia) endpoints called by the front
All under `games/{room}` (`routes/web.php:524-553`), via `retroRequest`:
`GET snapshot`; `PATCH /`; `DELETE /`; `POST guest-token`; `PUT host`; `PUT game`; `POST rounds`; `GET rounds/{round}`; `PUT timer`; `DELETE scores`; `POST shares`; `POST rounds/{round}/pass`; `POST …/letters`; `GET …/secret`; `POST …/hints`; `POST …/guesses`; `POST …/drawing-ops`; `DELETE …/drawing-ops/last`; `DELETE …/drawing`; `PUT …/clue`; `PUT …/question`; `PUT|DELETE …/answer`; `POST …/reveal`; `PUT|DELETE …/vote`; `POST …/close`; `GET gifs?q=`. Plus `POST broadcasting/auth` (Echo). GIF images load from `gifs/{gif}/{size}` (`routes/web.php:178-181`).

### Routes in this area that no front code calls
- `GET games/{room}/rounds` (`games.rounds.index`, `GameRoundsController@index`): no caller in `resources/js` outside generated Wayfinder files; history comes from the snapshot.

### Dead / unused
- No unused component found in `resources/js/components/games/` (each of the 48 files is imported somewhere).
- Snapshot fields never read by the front: `me.userId`, `links.retro`, `scoresResetAt`; `GameRoomSummary.updatedAt`; `GameGif.url`.
- `strokeIdPrefix()` is an identity function (kept for documentation).

### Surprises
1. **Any 403 on channel auth is shown as "room full"** (`use-game-channel.ts:54-61`). A player whose access was revoked (or any auth 403) who reconnects sees "This room is full." rather than "Your access to this room has ended.", and no resync is scheduled in that branch; `GameRoom` checks `full` before `status`.
2. `withBoardTimer` in the icebreaker has no visible effect: the only reader of `room.timerEndsAt` is `RoomTimer`, which is not mounted in the icebreaker (the retro board shows its own timer).
3. The 12-player cap is enforced only at channel authorisation; the page and all HTTP endpoints stay reachable for a 13th player.
4. Hand-over-hosting lists offline players too, and game switch / pass / regenerate link have no confirmation although they abandon a round or sign guests out.
5. Mixed `dispatch` vs `apply` for local results: only drawing ops and the timer use the buffered `apply`; other local patches can be overwritten by an in-flight refetch (then corrected by the next one).
6. `recentPicks` key is `${playerId}-${letter}` and the list is client-only (empty after reload).
7. PHPDoc of the snapshot `share` shape is narrower than the real payload (see Props).
8. `games/show` sets `<Head title>` to `''` when the room has no name.

### Hardcoded, untranslated user-facing strings
- Language names `English / Français / Español / Deutsch` (`room-settings-dialog.tsx:45-50`, endonyms, fallback to the raw code).
- Provider names `Tenor` / `GIPHY` (`gif-search-dialog.tsx:142`).
- Placeholders `'—'` (`history-drawer.tsx:63`), `'…'` (`leader-word.tsx:10`), `+{gained}` (`gif-round-results.tsx:58`), `': '` separator in the guess list.
- "12" baked into the translation key "Up to 12 players can be online at once.".

### Could not verify
- Bodies of `RevealGifRound`, `UndoDrawingOp`, `ClearDrawing`, `PickGifQuestion`, `DrawGameWord` (files not read; event payload shapes taken from the event classes and client types).
- `CloseExpiredGameRound` job body and whether its broadcast reaches all clients (inferred from `ScheduleRoundExpiry` and `EndGameRound`).
- Internals of shared components mounted here but owned by other slices: `EmojiPicker`, `LanguageSwitcher`, `DeliveryLines` (possible retry actions), `LiveCursorLayer`, `AuthLayout`, `retros/session-ended` page.
- `GuestCookie` lifetime and `GuestNames` content.
- Exact wire field for the whisper sender (`metadata.user_id`) was taken from the transport code and the Reverb config, not observed live.
- Nothing was run in a browser; behaviour is from reading code only.


---

<!-- part: 05-whiteboard -->

# Slice 05 — Whiteboard (`whiteboards/show`, `whiteboards/join`)

All paths relative to `/Users/aritti/Projects/skrum`. Front file refs are `file:line`.
Excalidraw is pinned at `@excalidraw/excalidraw` **0.18.1** (`package.json:17`); also `live-cursors ^0.2.0`, `live-reactions ^0.2.0` (`package.json:46-47`).

File map of the slice:

| Area | Files |
|---|---|
| Pages | `resources/js/pages/whiteboards/show.tsx`, `join.tsx` |
| Components | `resources/js/components/whiteboard/{board,board-menu,facilitator-bar,hand-over-dialog,save-template-dialog,scene-export,sticky-tool,status-bar,top-bar,board-reactions,board-gone}.tsx` |
| Hooks | `resources/js/hooks/use-whiteboard.ts`, `use-whiteboard-channel.ts`, `use-whiteboard-cursors.ts`, `use-whiteboard-follow.ts`, `use-whiteboard-request.ts`, `use-whiteboard-toolbar-slot.ts`, `use-countdown.ts` |
| Lib | `resources/js/lib/whiteboard/{excalidraw,scene-sync,restore,files,appearance,types}.ts`, `resources/js/lib/realtime/{whisper-transport,realtime-state}.ts` |
| Shared components reused | `components/realtime/flying-reactions.tsx`, `components/retro/{connection-banner,session-expired-banner,timer-display,presence-strip,emoji-picker}.tsx`, `hooks/use-local-preference.ts`, `hooks/use-retro-channel.ts` (`useSafeConnectionStatus`), `lib/retro/api.ts` (`retroRequest`, `RetroRequestError`), `lib/retro/emoji.ts` |
| Backend | `app/Http/Controllers/Whiteboards/*`, `app/Http/Controllers/WhiteboardJoinsController.php`, `app/Http/Middleware/ResolveWhiteboardMember.php`, `app/Actions/Whiteboards/*`, `app/Events/Whiteboards/*`, `app/Models/Whiteboard{,Member,Element,File}.php`, `routes/web.php:493-514` |

---

## pages/whiteboards/show.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `whiteboards/{board}` | `whiteboards.show` | GET | `Whiteboards\WhiteboardsController@show` — `Inertia::render('whiteboards/show')` at `app/Http/Controllers/Whiteboards/WhiteboardsController.php:21` | `web` + `ResolveWhiteboardMember` (`routes/web.php:496-500`), `whereUuid('board')`, `scopeBindings()`. **No `auth` middleware**: guests with a cookie are allowed. |

`ResolveWhiteboardMember` (`app/Http/Middleware/ResolveWhiteboardMember.php:17-40`) decides who gets in, through `ResolveMember` (`app/Actions/Whiteboards/ResolveMember.php:12-55`):

- Logged-in user who `can('view', $board->team)` -> `WhiteboardMember::firstOrCreate` (a member row is created on first visit).
- Otherwise a guest: only if `guest_access_enabled`, with cookie `whiteboard_guest_{boardId}` = `"{memberId}|{secret}"` (30 days, `app/Actions/Retros/GuestCookie.php:18-28`) matching a member row with `user_id null` and `guest_secret_hash = sha256(secret)`.
- No member, no user, HTML request: if the board has guest access -> renders the **`retros/session-ended`** Inertia page (sibling slice's page, `resources/js/pages/retros/session-ended.tsx`) after `redirect()->setIntendedUrl(fullUrl)`; else `redirect()->guest(route('login'))` (`:46-55`).
- No member, JSON request: `401` "Your session has expired." when there is neither user nor guest cookie, else `403` "You no longer have access to this board." (`:29-35`).
- Non-UUID or unknown board -> 404 (route binding).

### 2. Props

Single prop `snapshot`, built by `BuildWhiteboardSnapshot::handle` (`app/Actions/Whiteboards/BuildWhiteboardSnapshot.php:57-110`), typed on the front as `WhiteboardSnapshot` (`resources/js/lib/whiteboard/types.ts:13-43`). The same payload is returned as JSON by `GET whiteboards/{board}/snapshot`.

| Key | Type | Built at | Notes |
|---|---|---|---|
| `board.id` | string (uuid) | `:68` | |
| `board.title` | string (max 120) | `:69` | `<Head title>` + `<h1>` + Excalidraw `name` |
| `board.teamId` | string | `:70` | **not read by any front code** |
| `board.facilitatorMemberId` | string\|null | `:71` | a `WhiteboardMember` id (= presence id), used by follow-me |
| `board.guestAccessEnabled` | bool | `:72` | |
| `board.guestUrl` | string\|null | `:73` | absolute URL `whiteboards/join/{guest_token}`; `null` for guests; present for members **even when guest access is off** |
| `board.cursorsEnabled` | bool | `:74` | |
| `board.reactionsEnabled` | bool | `:75` | |
| `board.locked` | bool | `:76` | |
| `board.followEnabled` | bool | `:77` | |
| `board.timerEndsAt` | ISO-8601 string\|null | `:78`, `:138-147` | `null` once the timer ended more than 5 minutes ago (`TimerLingerMinutes`) |
| `me.id` | string | `:81` | member id = presence `user_id` |
| `me.userId` | string\|null | `:82` | null for guests |
| `me.name`, `me.avatarUrl` | string | `:83-84` | **not read by the front** (presence strip uses channel members) |
| `me.isGuest` | bool | `:85` | `guest_name !== null` (`app/Concerns/HasGuestIdentity.php:18-21`) |
| `me.isFacilitator` | bool | `:86` | `facilitator_member_id === member.id` |
| `me.canTakeControl` | bool | `:87` | `!isGuest && !isFacilitator` |
| `me.canDelete` | bool | `:88` | facilitator or workspace manager (`User::canManage(workspace)`) |
| `me.transferCandidates` | `{userId,name}[]` | `:89`, `:115-132` | only for a non-guest facilitator: team members + workspace owners/admins, minus self, ordered by name |
| `members` | `PresenceMember[]` `{id,name,avatarUrl,isGuest}` | `:91-99` | every member row ever created on the board; front uses it only as a name fallback for reaction labels (`board-reactions.tsx:28`) |
| `elements` | `SceneElement[]` | `:100-103` | live elements only (`is_deleted = false`), in fractional-index order (`OrderWhiteboardElements`), each is the stored `data` JSON verbatim (`PresentWhiteboardElement.php:17`) |
| `seq` | int | `:104` | board write sequence |
| `links.team` | string\|null | `:105-107` | relative URL of `teams.show`; null for guests |
| `serverTime` | string `Y-m-d\TH:i:s.v\Z` | `:108` | clock offset for the timer |

TS vs PHP: **no mismatch** (PHPStan shape `:13-43` equals `types.ts:13-43`).

Shared props read: `locale` (`board.tsx:49`, mapped to Excalidraw `langCode`), `translations` (through `useTrans`), `name` (title callback in `resources/js/app.tsx:41-46`). Nothing else (no app layout, so no sidebar/notifications).

### 3. Layout

None: `resources/js/app.tsx:57-62` returns `null` for `whiteboards/show`. The page is full-viewport (`h-dvh`).

### 4. Page structure, lazy loading and SSR handling

- `show.tsx:20,60` — the board is loaded with `React.lazy(() => import('@/components/whiteboard/board'))`, so Excalidraw and its CSS (`lib/whiteboard/excalidraw.ts:2` imports `@excalidraw/excalidraw/index.css`) are in a separate chunk and never evaluated on the server. `Suspense` fallback is `<Skeleton className="h-dvh w-full" />` (`:74`).
- `ChunkBoundary` (error boundary, `:22-43`) catches chunk-load **and any render error of the board**; logs `whiteboard: the canvas failed`; shows `CanvasError` ("The canvas could not be loaded." + "Retry", `:45-56`). Retry creates a fresh `lazy()` and bumps the boundary `key` (`:62-65`).
- SSR: Inertia SSR is off by default (`config/inertia.php:19`, `INERTIA_SSR_ENABLED=false`) but `build:ssr` exists. SSR-safe guards present: lazy import; `useSyncExternalStore(subscribeToTheme, isDark, () => false)` (`board.tsx:84`); `createHost` returns null without `document` (`use-whiteboard-toolbar-slot.ts:5-7`); `useLocalPreference` checks `window` (`use-local-preference.ts:8`); `TimerDisplay` renders nothing until mounted (`timer-display.tsx:61`).

Rendered tree (`board.tsx:174-290`):

```
<div h-dvh>
  SessionExpiredBanner            (when sessionExpired)
  <div inert={sessionExpired}>
    TopBar: [back link] h1 title · PresenceStrip · TimerDisplay · FacilitatorBar(facilitator) · StickyTool(fallback) · BoardMenu
    ConnectionBanner (reconnecting || offline)
    StatusBar (role=status; locked / follow messages)
    portal -> StickyTool inToolbar (inside Excalidraw's shapes toolbar)
    <div.whiteboard-canvas data-facilitator> <Excalidraw> <MainMenu/> </Excalidraw> </div>
    BoardReactions (.whiteboard-reactions, sibling of the canvas)
  </div>
</div>
```

When `state.status !== 'active'` the whole page is replaced by `BoardGone` (`board.tsx:165-172`).

### 5. User actions

"HTTP" calls all go through `retroRequest` (`lib/retro/api.ts:38-78`): Inertia's XHR client, `Accept: application/json`, `X-Socket-ID` header (so server `toOthers()` skips the caller), 15 s timeout (-> `RetroRequestError(0,'timeout')`), error message = first validation error, else `message`.

| Action | UI element | HTTP / route / controller | Who |
|---|---|---|---|
| Retry loading the canvas | `show.tsx:51` button "Retry" | client-only (re-import chunk) | anyone |
| Back to the team | `top-bar.tsx:21-27` icon link (`aria-label` "Back to the team") | Inertia visit to `links.team` (`teams.show`) | non-guests only (`links.team` null for guests) |
| See who is online | `top-bar.tsx:31` `PresenceStrip` (8 avatars + "+N", tooltip name + "· Guest") | client-only (presence) | anyone |
| Draw / edit / delete / move / group / reorder elements, paste, undo/redo, all native Excalidraw tools | `<Excalidraw onChange>` `board.tsx:241-246` -> `sceneSync.handleChange` | `PUT whiteboards/{board}/elements` `whiteboards.elements.update` `WhiteboardElementsController@update` (debounced 300 ms, batches of 200, see §Scene sync) | anyone, unless board locked and not facilitator (view mode + server 403) |
| Add an image (Excalidraw image tool / paste / drop) | native | `POST whiteboards/{board}/files` `whiteboards.files.store` (multipart, raw `fetch`, `files.ts:32-71`) **then** the element PUT | same as above |
| Load an image shown on the board | automatic (`scene-sync.ts:213-242`) | `GET whiteboards/{board}/files/{fileId}` `whiteboards.files.show` (raw `fetch`, blob -> data URL -> `api.addFiles`) | anyone |
| Add a sticky note (pick 1 of 6 colours) | `sticky-tool.tsx:104-150`; trigger injected in Excalidraw toolbar before the eraser (`board.tsx:225-230`) or, as fallback, a "Sticky note" button in the top bar (`board.tsx:187-189`) | client-only `api.updateScene` (`:95-99`, `CaptureUpdateAction.IMMEDIATELY` = undoable), then synced by the normal PUT | anyone who can edit (hidden when `viewOnly`) |
| Lock / unlock an element (Excalidraw context menu, Ctrl/Cmd+Shift+L) | native; the context-menu entries `toggleElementLock` / `unlockAllElements` are hidden by CSS for non-facilitators (`resources/css/app.css:207-213`, driven by `data-facilitator`, `board.tsx:234`) | element PUT; server refuses with reason `locked` for non-facilitators (`WriteWhiteboardElements.php:149-151,186-189`) | facilitator only |
| Export dialog: "Download board data" | `scene-export.tsx:65` inside Excalidraw's JSON export dialog (`UIOptions.canvasActions.export.renderCustomUI`, `board.tsx:257-271`) | client-only: `serializeAsJSON(elements, appState, files, 'local')`, `source` overwritten with `window.location.origin`, pretty-printed, downloaded as `{title}.whiteboard.json` (illegal filename chars replaced) | anyone |
| Main menu: Export, Save as image, Search (find on canvas), Help, Clear canvas, Change canvas background | `board.tsx:276-284` | client-only (Clear canvas produces deletions that are synced; background colour is local app state, **not synced**) | anyone (menu is Excalidraw's; in view mode Excalidraw shows its reduced menu) |
| Send a flying reaction (6 quick emoji + emoji picker) | `components/realtime/flying-reactions.tsx:115-134` via `board-reactions.tsx` | client-only whisper `client-reaction` | anyone, when `board.reactionsEnabled` and presence channel is up |
| Open board menu | `board-menu.tsx:126-135` icon button (`aria-label` "Board menu") | client-only | anyone |
| Hide my cursor (checkbox) | `board-menu.tsx:137-142` | client-only, `localStorage['skrum.hideMyCursor']` (`board.tsx:44,55-58`) — same key name pattern as other boards, global not per board | anyone |
| Take control (become facilitator) | `board-menu.tsx:143-158` | `PUT whiteboards/{board}/facilitator` `whiteboards.facilitator.update` `WhiteboardFacilitatorsController@update` body `{user_id: me.userId}`; then snapshot refetch | non-guest non-facilitator (`me.canTakeControl && me.userId`); server: must be self and `can('view', team)` (`:62-67`) |
| Duplicate this board | `board-menu.tsx:161-163`, `duplicate()` `:94-108` | `POST whiteboards/{board}/duplicate` `whiteboards.duplicate.store` `WhiteboardDuplicatesController@store` -> `201 {url}`; then `router.visit(url)` | non-guests (`WhiteboardGuard::notGuest`) |
| Save as template (dialog: Name ≤80 required, Description ≤300) | `board-menu.tsx:164-168` + `save-template-dialog.tsx` | `POST whiteboards/{board}/template` `whiteboards.template.store` `WhiteboardTemplatesController@store` body `{name, description|null}` -> `201 {id,name}` (ignored); toast "Template saved."; 422 on `name`/`description` shown inline (`:130-143`), other errors as toast | non-guests |
| Rename (dialog, input ≤120, `aria-label` "Title") | `board-menu.tsx:174-178,248-261,298-329` | `PATCH whiteboards/{board}/settings` `whiteboards.settings.update` `WhiteboardSettingsController@update` `{title}`; refetch; dialog closes only on success | facilitator (`WhiteboardGuard::facilitator`) |
| Hand over facilitation (dialog with Select of `me.transferCandidates`; empty state "No one else can facilitate this board yet.") | `board-menu.tsx:179-183` + `hand-over-dialog.tsx` | `PUT whiteboards/{board}/facilitator` `{user_id}`; refetch; close | facilitator, non-guest; server: target must `can('view', team)` else 422 `user_id` (`:49-56`); target's member row is created if needed; **`follow_enabled` is reset to false** (`:41`) |
| Show live cursors (checkbox) | `board-menu.tsx:184-191` | `PATCH …/settings` `{cursors_enabled}` + refetch | facilitator |
| Show flying reactions (checkbox) | `board-menu.tsx:192-201` | `PATCH …/settings` `{reactions_enabled}` + refetch | facilitator |
| Allow guests to join with a link (checkbox) | `board-menu.tsx:202-211` | `PATCH …/settings` `{guest_access_enabled}` + refetch | facilitator |
| Replace the guest link | `board-menu.tsx:212-226` (only when guest access on) | `POST whiteboards/{board}/guest-token` `whiteboards.guestToken.store` `WhiteboardGuestTokensController@store` -> `{guestUrl}` (ignored; refetch). Server also nulls every guest's `guest_secret_hash`: **all current guests lose access** (`:30-33`) | facilitator |
| Copy the guest link | `board-menu.tsx:229-233`, `copyGuestLink` `:85-92` | client-only `navigator.clipboard.writeText(board.guestUrl)`; toast "Link copied." (no try/catch on clipboard failure) | non-guests, when guest access on |
| Delete this board (confirm dialog "Delete this board?" / "Everything on it is removed for everyone.") | `board-menu.tsx:234-244,275-293`, `deleteBoard` `:110-122` | `DELETE whiteboards/{board}` `whiteboards.destroy` `WhiteboardsController@destroy` -> 204; then `router.visit(links.team)` | `me.canDelete` (facilitator or workspace owner/admin; `WhiteboardGuard::canDelete`) |
| Start timer 1 / 3 / 5 / 10 min | `facilitator-bar.tsx:63-78` dropdown (`aria-label` "Timer") | `PUT whiteboards/{board}/timer` `whiteboards.timer.update` `WhiteboardTimersController@update` `{seconds}` (server accepts 10..3600) -> `{timerEndsAt}`; applied locally with `state.setTimer` (`:39-41`), no refetch; items disabled while busy | facilitator |
| Stop timer | `facilitator-bar.tsx:80-85` (disabled when no timer) | same endpoint `{seconds: null}` | facilitator |
| Lock / unlock the board (toggle, `aria-pressed`) | `facilitator-bar.tsx:88-103` | `PATCH …/settings` `{locked}` + refetch | facilitator |
| Bring everyone to me (follow-me toggle, `aria-pressed`) | `facilitator-bar.tsx:104-117` | `PATCH …/settings` `{follow_enabled}` + refetch | facilitator |
| Resume following | `board.tsx:215-221` button "Resume" in the status bar | client-only (`follow.resume`) | followers whose follow is paused |
| Pause following | implicit: any manual pan/zoom while following (`use-whiteboard-follow.ts:155-171`) | client-only | followers |
| Reload after session expiry | `session-expired-banner.tsx:13-19` "Reload" | `window.location.reload()` | anyone |
| Back to the team (gone screen) | `board-gone.tsx:21-25` | Inertia link | non-guests |

Error handling of the menu/facilitator actions: `attempt`/`run` (`board-menu.tsx:51-75`) and `useWhiteboardRequest` (`use-whiteboard-request.ts`) toast the server message (or "Something went wrong. Please try again." for timeouts/network) and do nothing else. No optimistic updates anywhere except the timer response; every settings change waits for the snapshot refetch.

Keyboard: all Excalidraw shortcuts stay active, **except** save-to-disk (Ctrl+Shift+S) which is disabled (see §Excalidraw customisations). No app-level shortcuts.

### 6. Excalidraw 0.18.1 customisations (everything a rewrite must carry over)

All library access goes through `resources/js/lib/whiteboard/excalidraw.ts` (single import point).

Props passed (`board.tsx:236-274`):

| Prop | Value | Why |
|---|---|---|
| `viewModeEnabled` | `viewOnly ? true : undefined` (`viewOnly = board.locked && !me.isFacilitator`, `:52`) | `undefined` (not `false`) leaves Excalidraw's own view-mode toggle usable |
| `excalidrawAPI` | `setApi` | imperative API kept in state; everything else waits for it |
| `initialData` | `{ elements: restoreScene(snapshot.elements) }` computed once (`:62-65`) | no `appState`, no `files` (files are fetched afterwards) |
| `name` | `board.title` | used by Excalidraw for image export file names |
| `onChange` | `sync.handleChange(elements, appState.editingTextElement?.id ?? null)` | scene sync |
| `onPointerUpdate` | `cursors.onPointerUpdate` | live cursors |
| `langCode` | `CanvasLocales[locale] ?? 'en'` — `en→en`, `fr→fr-FR`, `de→de-DE`, `es→es-ES` (`appearance.ts:2-7`) | locale sync |
| `theme` | `'dark'`/`'light'` from a `MutationObserver` on `<html class>` (`appearance.ts:9-20`, `board.tsx:84`) | follows the app theme live |
| `aiEnabled` | `false` | hides AI tools (text-to-diagram, magic frame) |
| `UIOptions.canvasActions` | `loadScene:false`, `saveToActiveFile:false`, `toggleTheme:false`, `saveFileToDisk:false` (untyped key, `HiddenSaveToDiskAction`, `excalidraw.ts:26-33`), `export: { saveFileToDisk:false, renderCustomUI: <SceneExport/> }` | no scene loading, no theme switch, no `.excalidraw` file save (also kills Ctrl+Shift+S); the JSON export dialog only shows our "Download board data" |
| children | custom `<MainMenu>`: `Export`, `SaveAsImage`, `SearchMenu`, `Help`, `ClearCanvas`, separator, `ChangeCanvasBackground` (`board.tsx:276-284`) | drops the default menu's Load scene, theme toggle, live-collaboration and social links |

Not passed (so library defaults apply): `isCollaborating`, `renderTopRightUI`, `onLibraryChange`, `validateEmbeddable`, `onScrollChange` (the hook uses `api.onScrollChange` instead), `UIOptions.tools`, `WelcomeScreen`, `Footer`, `LiveCollaborationTrigger`.

DOM / internals hacks (each has a "check on upgrade" comment):

1. **Sticky-note tool injected in the shapes toolbar** — `use-whiteboard-toolbar-slot.ts`: a `display:contents` host `<div>` is inserted right before the eraser's `.ToolIcon` (selector `.App-toolbar [data-testid="toolbar-eraser"]`), re-inserted by a `MutationObserver` (childList+subtree on the canvas container) whenever Excalidraw re-renders the row. The React `StickyTool` is portalled into it (`board.tsx:225-230`) and uses Excalidraw's own class names (`ToolIcon ToolIcon_type_button ToolIcon_size_medium ToolIcon_type_button--show`, `ToolIcon__icon`; `excalidraw.ts:73-79`). When the toolbar is absent (view mode, other layout) the hook returns null and the tool is shown as a normal button in the top bar unless `viewOnly` (`board.tsx:187-189`).
2. **Sticky note = marked rectangle** — `sticky-tool.tsx:39-68`: 200×200 rectangle, `strokeColor:'transparent'`, solid fill, `roughness:0`, `roundness:null`, `customData:{skrum:{kind:'sticky'}}`, 20-char id from `crypto.randomUUID()`, centred in the viewport (`x = width/2/zoom − scrollX − 100`), passed through `restoreElements`, appended with `updateScene` and selected. Colours: `#fff3bf #ffd8a8 #ffc9c9 #d0bfff #a5d8ff #b2f2bb` named Yellow/Orange/Red/Purple/Blue/Green. Swatches get `dark:[filter:invert(93%)_hue-rotate(180deg)]` (`CanvasDarkFilterClass`, `excalidraw.ts:58-65`) to match Excalidraw's dark-canvas filter. Server keeps the marker only on `rectangle` and strips any other `customData` (`SanitizeWhiteboardElement.php` `withStickyMarkerOnly`), and stores `is_sticky`.
3. **Closing the text editor** — `closeTextEditor()` (`excalidraw.ts:88-94`) dispatches a synthetic `Escape` keydown on `.excalidraw textarea.excalidraw-wysiwyg`. Used when the board becomes view-only (`board.tsx:143-153`, inside `queueMicrotask`, then clears `selectedElementIds`) and when unsent edits are discarded (`scene-sync.ts:580`).
4. **Container-height keeper** — `scene-sync.ts:127-211`: works around Excalidraw's `originalContainerCache` shrinking a note that someone else made taller the moment its text is edited: on a change during text editing, if the bound container got shorter than last seen (and the text did not get shorter), the height is put back by setting the scene twice (font size +1, then back). Self-disables with a console error if it does not hold.
5. **Double `reconcileElements` attempt** — `scene-sync.ts:267-290`: the dev build throws on index flaws it otherwise repairs; second try, else full recovery.
6. **Index-order discipline** — `restore.ts`: elements are sorted by fractional index (code-unit comparison, then id) before `restoreElements`; elements with an invalid fractional index are dropped with a console error; versions/nonces changed by `restoreElements` are reverted to the server's unless the index itself was repaired; falls back to one-by-one restore so a single bad element cannot take the board down.
7. **CSS** (`resources/css/app.css:170-213`): moves Excalidraw's `.scroll-back-to-content` above the reactions bar (72 px / 120 px mobile), moves the reactions bar above the mobile bottom toolbar (`.excalidraw--mobile`), hides it while `.App-mobile-menu` is open, hides the lock entries of the context menu for non-facilitators.
8. **Collaborator cursors** are drawn by Excalidraw itself via `api.updateScene({collaborators})` (not by the `live-cursors` layer used on retro/poker).
9. **Follow-me** uses `api.onScrollChange`, `api.getAppState()` and `updateScene({appState:{scrollX,scrollY,zoom}})`, clamped to Excalidraw's zoom limits 0.1–30.
10. Remote and forced updates use `captureUpdate: CaptureUpdateAction.NEVER` (never enter the local undo stack) (`scene-sync.ts:121-124`).

Server-side element whitelist (`SanitizeWhiteboardElement.php:33-46`): types `rectangle, diamond, ellipse, arrow, line, freedraw, text, image, frame` only. Excalidraw's `embeddable`, `iframe`, `magicframe` elements are refused as `invalid` (the client then deletes them locally and toasts). `link` kept only if `http(s)://`; text ≤ 10 000 chars; element JSON ≤ 65 536 bytes; ids `[A-Za-z0-9_-]{1,40}`; file ids `[A-Za-z0-9_-]{1,64}`; version ≤ 2 147 483 647.

### 7. Scene-sync protocol (`lib/whiteboard/scene-sync.ts`)

**Transport split.** Elements never travel over whispers. HTTP carries: element writes (PUT), deltas (GET elements), full snapshot (GET snapshot), image bytes (POST/GET files), all settings. Server broadcasts carry: element changes, timer, "board changed" ping, "board deleted". Whispers (client events) carry only ephemeral things: cursors, viewport (follow-me), reactions.

**Server model.** `whiteboards.seq` is a per-board counter; each accepted element gets the next `seq` (`WriteWhiteboardElements.php:76-78`). `whiteboard_elements` row = `element_id`, `type`, `data` (sanitised element JSON), `version`, `version_nonce`, `is_sticky`, `is_deleted` (tombstone), `seq`, `author_member_id`. `whiteboards.purged_seq` = highest seq of tombstones already hard-deleted (tombstones older than 24 h are purged daily by `skrum:prune-whiteboards`, `PurgeWhiteboardTombstones.php`; unused images likewise, `PruneWhiteboardFiles.php`).

**Client state** (`:73-94`): `known` (id -> `"version:versionNonce"` the server is known to hold), `pending` (id -> element to send), `files` (file ids already on the server or being fetched), `seen` (last stamp/height per element), `seq` (applied), `wantedSeq` (highest announced).

**Outgoing (local edits)** — `handleChange` (`:646-689`), called on every Excalidraw `onChange` with all elements including deleted:
- skip when stamp equals `known`; skip never-sent deleted elements; skip images whose `fileId` is not set yet; skip everything while a locked-discard is in progress;
- otherwise put in `pending` (latest copy wins) and schedule a flush in **300 ms** (`FlushDelayMs`; a timer already running is not reset — it is a throttle-like debounce).
- `flush` (`:420-484`): one at a time; takes up to **200** elements (`MaxBatch`, equal to server `WriteWhiteboardElements::MaxBatch`); for each non-deleted image whose file is not known, uploads the file first (`withUploadedFiles`, `:362-404`; an image whose binary is not in `api.getFiles()` yet is re-queued); then `PUT whiteboards/{board}/elements` with JSON body `{"elements":[…]}` (the controller reads the raw body with `json_decode`, `WhiteboardElementsController.php:48-52`: `required|array|list|min:1|max:200`).
- Response `WriteResponse` `{seq, fromSeq, rejected:[{id, reason, element}]}` (`WriteWhiteboardElements.php:13-14,84-92`). The client marks every sent element as `known`, then `settle`s rejections (`:406-418`), sets `wantedSeq = max(…, seq)`, and: if `fromSeq === local seq` -> `seq = response.seq` (nothing was missed); else if `response.seq > seq` -> `resync()`.
- If more is pending, next flush after 300 ms (2000 ms after a failure, `RetryDelayMs`).

**Server decision per element** (`WriteWhiteboardElements.php:50-82,143-181`), inside a transaction with the board row `lockForUpdate`:
1. sanitise -> `invalid` if it fails (with the stored copy if any);
2. same `version` + `versionNonce` as stored -> silently ignored (idempotent retry);
3. `stale`: lower version than stored, or same version with a **higher** nonce (Excalidraw's rule: higher version wins, tie -> lower nonce);
4. `locked`: non-facilitator and either the incoming or the stored element has `locked: true`;
5. `file`: image, not deleted, whose `fileId` is not in `whiteboard_files`;
6. `full`: would add a live element when the board already has `MaxLiveElements` = 5000.
Accepted elements are saved, the board `seq` updated, and `WhiteboardElementsChanged(boardId, seq, fromSeq, elements|null)` is broadcast to others; `elements` is `null` when the JSON exceeds `MaxBroadcastBytes` = 8000 (Reverb `max_message_size` is 10 000, `config/reverb.php:89`).

**Rejections on the client** (`settle`, `:406-418`): with a server copy -> `force` it over the local one regardless of version (`:296-323`); with only an id -> `dropLocally` (mark deleted without sending, `:325-340`). A toast is shown for every reason except `stale` (`board.tsx:99-105,117-118`, toast id = reason so they do not stack): `invalid` "This element could not be saved.", `locked` "Only the facilitator can change a locked element.", `file` "This image could not be added.", `full` "This board is full.".

**HTTP failures of a flush** (`:458-476`):
- 403 with `errors.locked` (board locked, `WhiteboardGuard::notLocked`, `WhiteboardGuard.php:34-46`) -> `discard()`: close the text editor, clear `pending`, reload the scene from the snapshot dropping everything the server does not hold; `onLocked` toasts "This board is locked." and refetches the snapshot (`board.tsx:120-124`).
- 401 / 403 / 404 / 419 -> `onFatal` -> `useWhiteboard.fail` (401/419 -> session-expired banner; 404 -> "deleted"; 403 -> "ended").
- anything else (**429 from the throttle**, 5xx, timeout, network) -> batch re-queued, `offline = true` (shows the "Reconnecting…" banner), retry in 2 s.

**Throttle `whiteboard-writes`** (`app/Providers/AppServiceProvider.php:77-82`, applied only to `PUT elements`, `routes/web.php:509`): `Limit::perSecond(20)` keyed by `(Auth::id() ?? request IP) | boardId`. Guests are therefore keyed by IP. The client's 300 ms cadence stays far below it.

**Incoming (`elements.changed`)** — `handleRemote` (`:690-705`): `wantedSeq = max`; ignore if `payload.seq <= seq`; if the payload carries `elements` **and** `payload.fromSeq === seq` -> `applyRemote` + `seq = payload.seq`; otherwise (gap, or elements omitted) -> `resync()`.
- `applyRemote` (`:252-293`): `restoreScene` then Excalidraw's `reconcileElements(local, remote, appState)` (local copy survives when newer or being edited) -> `updateScene` with `CaptureUpdateAction.NEVER`; then `remember` (marks as known, triggers image download).

**Resync / delta** — `resync` (`:605-640`, single-flight): loops `GET whiteboards/{board}/elements?since={seq}` (`WhiteboardElementsController@index`: returns `{seq, elements}` with every element — including tombstones — whose `seq > since`, in index order) until `seq >= wantedSeq` or 3 consecutive fetches bring nothing (`MaxIdleFetches`). **409** ("This board changed too much. Reloading it.", `since < purged_seq`, `WhiteboardElementsController.php:31`) -> `recover()`.
Triggered by: presence `here` and channel `error` (coalesced 250 ms, `use-whiteboard-channel.ts:18,65-75`), once when the canvas API becomes ready (`board.tsx:134`), a write response showing a gap, an event with a gap, and **every 5 s while the socket is not connected** (`PollMs`, `board.tsx:155-163`).

**Recovery / full reload** — `recover` -> `replaceScene` (`:487-574`): `GET whiteboards/{board}/snapshot`; local elements absent from the snapshot are marked deleted unless they are pending or never sent (kept) — or all dropped when discarding for a lock; snapshot elements are forced in; `seq = snapshot.seq`. Retried with exponential backoff 2 s, 4 s, … capped at 30 s; while a recovery is owed the board reports offline (`:97-98`).

**Images** (`lib/whiteboard/files.ts`): upload = raw `fetch` `POST whiteboards/{board}/files`, `FormData{file_id, file}`, headers `Accept: application/json` + `X-XSRF-TOKEN` read from the cookie (no `X-Socket-ID`); 413/415/422 -> `FileRefusedError` (element dropped locally + toast `file`); 401/403/404/419 -> `RetroRequestError` (fatal or locked); else plain error (retry). Server (`WhiteboardFilesController.php:24-72`): `file` ≤ 5120 KB, sniffed MIME must be png/jpeg/webp/gif, 100 MB per board total, idempotent per `file_id` (200 with existing, else 201 `{id,url,mimeType}` — response body unused by the client), refused with 403-locked on a locked board. Download = `GET …/files/{fileId}` streamed, `Cache-Control: private, max-age=31536000, immutable`; client turns the blob into a data URL and calls `api.addFiles`. A failed download is forgotten so a later change retries it.

**Note on sanitisation**: the writer never receives the sanitised copy back (broadcast is `toOthers`, write response has only rejections), so the author's canvas may keep fields the server stripped (non-http `link`, foreign `customData`) until a reload.

### 8. Realtime

Channel: **presence `whiteboard.{boardId}`** (wire name `presence-whiteboard.{uuid}`), joined in `hooks/use-whiteboard-channel.ts:76-93` with `echo().join()`, only while `status === 'active'` and Echo is configured. Auth: `BroadcastAuthorizationsController@store` -> `authorizeWhiteboardChannel` (`app/Http/Controllers/BroadcastAuthorizationsController.php:139-167`): board must exist, caller must resolve to a member through `ResolveMember`; presence `user_id` = member id, `user_info` = `{id, name, avatarUrl, isGuest}`.

Server events — all extend `WhiteboardBroadcastEvent` (`ShouldBroadcastNow`, `ShouldDispatchAfterCommit`, sent with `sendToOthers()` = `broadcast()->toOthers()` after commit, wrapped in `rescue`, `app/Events/Concerns/SendsToOthers.php`):

| `.event` | Class | Payload | Dispatched by | Client reaction |
|---|---|---|---|---|
| `.elements.changed` | `WhiteboardElementsChanged` | `{seq, fromSeq, elements?}` (elements omitted above 8000 bytes) | `WriteWhiteboardElements.php:90` | `sceneSync.handleRemote` (via `listeners.current`, `use-whiteboard.ts:128-130`) |
| `.timer.changed` | `WhiteboardTimerChanged` | `{timerEndsAt: string\|null}` | `WhiteboardTimersController.php:37` | `setTimer` (`use-whiteboard.ts:120-126`) |
| `.board.changed` | `WhiteboardChanged` | `{}` | settings, guest-token, facilitator controllers | refetch snapshot (meta only: `board/me/members/links`, elements ignored; also re-measures the clock offset) (`use-whiteboard.ts:66-97,114-118`) |
| `.board.deleted` | `WhiteboardDeleted` | `{}` | `WhiteboardsController.php:41` | `status = 'deleted'` -> `BoardGone` |

Cross-check: 4 server events, 4 listened (`WhiteboardEvents`, `use-whiteboard-channel.ts:7-12`). None unlistened, none listened without a server class.

Presence: `here` (dedupes by id — two tabs are one member — and schedules a resync), `joining`, `leaving` (removes from `online` and calls `onLeaving` -> forgets that member's cursor, `board.tsx:131`), `error` (schedules a resync). `online` feeds `PresenceStrip`, cursor names, reaction labels/origins and whisper sender validation.

Whispers (all through `lib/realtime/whisper-transport.ts`: sends `channel.whisper(event, data)`, listens on `.client-{event}`; the sender id is taken from Reverb's `metadata.user_id` — `accept_client_events_from = members`, `config/reverb.php:90` — never from the payload; send errors swallowed):

| Whisper | Payload | Sender | Receiver | File |
|---|---|---|---|---|
| `client-cursor` | `{x, y}` in **scene coordinates** (from Excalidraw `onPointerUpdate`) | every client when `board.cursorsEnabled`, not `hideMyCursor`; throttled 40 ms (drops, no trailing send) | accepted if sender ≠ me, sender is in the presence roster and x/y finite; max 50 cursors; cursor expires after 3 s without update (sweep every 1 s); rendered as Excalidraw collaborators `{id, username, color: hsl(hash(memberId)), pointer:{x,y,tool:'pointer'}}` | `use-whiteboard-cursors.ts` |
| `client-viewport` | `{x: -scrollX, y: -scrollY, width: w/zoom, height: h/zoom}` (scene rectangle the facilitator sees) | facilitator only, when `board.followEnabled`; on scroll change throttled 100 ms, once on start, and repeated every 2 s (late joiners) | accepted only from `board.facilitatorMemberId` with finite positive size; fits the rectangle centred in the local window (zoom clamped 0.1–30); a local pan/zoom that differs from the applied view pauses following until "Resume" | `use-whiteboard-follow.ts` |
| `client-reaction` | built by `live-reactions`; must contain `e` = a single emoji | anyone, when `board.reactionsEnabled` | accepted if sender in roster, `isSingleEmoji(raw.e)`, and per-sender token bucket `{burst:5, perSecond:2}`; flies up from the sender's avatar in the presence strip (`[data-presence-id]`), else near centre; label = member name | `components/realtime/flying-reactions.tsx`, `components/whiteboard/board-reactions.tsx` |

`BoardReactions` is unmounted when reactions are off (incoming ones dropped too) and keyed by `boardId:channelKey(presence)` so it rebuilds if Echo swaps the channel object.

Connection state (`use-whiteboard-channel.ts:113-116`): `connected = status === 'connected'`; `reconnecting = status === 'failed' || (wasConnected && !connected)`. `ConnectionBanner` shows "Reconnecting…" when `reconnecting || offline` (offline = HTTP sync failing or recovery owed). While not connected, deltas are polled every 5 s. On (re)subscription: snapshot refetch + delta resync, coalesced 250 ms.

`lib/realtime/realtime-state.ts` (`realtimeState`) and `components/realtime/live-cursors.tsx` are **not used by the whiteboard** (used by retro, poker, games, action-items).

### 9. Role / permission-conditional UI

| UI | Condition (prop) | Server check |
|---|---|---|
| Facilitator bar (timer, lock board, follow-me) | `me.isFacilitator` (`board.tsx:186`) | `WhiteboardGuard::facilitator` in settings/timer controllers |
| Menu: Rename, Hand over, cursors/reactions/guest toggles, Replace guest link | `me.isFacilitator` (`board-menu.tsx:171`) | `WhiteboardGuard::facilitator`; hand-over additionally refuses guests (`WhiteboardFacilitatorsController.php:22-24`) |
| Menu: Take control | `me.canTakeControl && me.userId` | self + team view. **Any team member can take facilitation at any time**, even from a present facilitator (by design: "a missing facilitator must not freeze it", `:58-61`) |
| Menu: Duplicate, Save as template | `!me.isGuest` | `WhiteboardGuard::notGuest` |
| Menu: Copy the guest link | `!me.isGuest && board.guestAccessEnabled` | `guestUrl` is null for guests |
| Menu: Delete | `me.canDelete` | `WhiteboardGuard::canDelete` (facilitator or workspace manager) |
| Menu: Hide my cursor | everyone | client-only |
| Back-to-team link (top bar and gone screen) | `links.team` (null for guests) | — |
| Canvas view mode, no sticky tool, text editor closed, selection cleared, status "This board is locked." with lock icon | `board.locked && !me.isFacilitator` | 403 `errors.locked` on element PUT and file POST |
| Element lock entries in context menu | CSS on `data-facilitator="false"` | rejection `locked` |
| Status "Everyone follows your view." | `board.followEnabled && me.isFacilitator` | — |
| Status "Following the facilitator" / "Following paused" + Resume | `board.followEnabled && !me.isFacilitator` | — |
| Reactions bar | `board.reactionsEnabled` and presence up | none (whispers) |
| Sending / showing cursors | `board.cursorsEnabled`; own sending also `!hideMyCursor` | none (whispers) |
| Presence tooltip "· Guest" | presence `isGuest` | — |

A guest can be facilitator only if… they cannot: facilitator is set at creation (sibling slice) or via the facilitator endpoint, which always targets a `User`.

### 10. Other state worth preserving

- Board status machine (`use-whiteboard.ts:15,56-64`): `active` -> `deleted` (event `board.deleted`, or any 404) / `ended` (any 403 other than board-locked: guest link replaced, guest access switched off, removed from team). `BoardGone` texts: "This board was deleted." / "Your access to this board has ended.". Leaving `active` also leaves the presence channel.
- Session expiry (401/419): `SessionExpiredBanner` (`role="alert"`) + the whole board made `inert` (`board.tsx:176-180`); status stays `active`.
- Snapshot refetch is last-write-wins by request counter (`latestRefetch`, `use-whiteboard.ts:67,75`); it never touches elements.
- Clock offset: `serverTime − Date.now()` at load, re-measured with the request midpoint on each refetch (`:79-82`); `TimerDisplay` counts down every 250 ms, shows `m:ss`, turns red and shows "Time's up!", toasts "Time's up!" and beeps (880 Hz, 0.6 s, WebAudio) once per timer and only if this client saw it running (`timer-display.tsx:32-59`). A timer that ended >5 min ago is not reported by the snapshot.
- Toast ids `invalid|locked|file|full` dedupe repeated rejections.
- a11y: `role="toolbar"` + `aria-label` "Facilitation tools" and "Reactions"; `role="status"` status bar (renders nothing when empty) and connection banner; `role="timer"`; `aria-pressed` on lock/follow toggles; `aria-label`s on icon buttons; dialogs use `aria-describedby={undefined}` except save-template (has a description).
- Dialog bodies are mounted only while open (`{open && <Form/>}`) so their state resets each time.
- Per-element authorship (`author_member_id`) and `is_sticky` are stored but never sent to or shown by the front.
- Canvas background colour, zoom, scroll, selected tool, Excalidraw library items: local only, not persisted (no `appState` in `initialData`, no `onLibraryChange`).
- Console diagnostics prefixed `whiteboard:` (not user-facing).
- Untranslated user-facing strings: the fallback file name `whiteboard` in `sceneFileName` (`scene-export.tsx:14`); otherwise everything goes through `t()` (spot-checked keys exist in `lang/fr.json`). Excalidraw's own UI is translated by the library through `langCode`.

---

## pages/whiteboards/join.tsx

### 1. Routes

| URI | Name | Method | Controller | Middleware |
|---|---|---|---|---|
| `whiteboards/join/{guestToken}` | `whiteboards.join.show` | GET | `WhiteboardJoinsController@show` — `Inertia::render('whiteboards/join')` at `app/Http/Controllers/WhiteboardJoinsController.php:27` (valid) and `:72` (invalid, **HTTP 404**) | `web` only (public) |
| `whiteboards/join/{guestToken}` | `whiteboards.join.store` | POST | `WhiteboardJoinsController@store` (`:35-60`); re-renders the invalid page with 404 if the token is no longer valid | `web`, `throttle:10,1` |

A token is valid only if a board has that `guest_token` **and** `guest_access_enabled` (`:62-68`). If the visitor already resolves to a member (logged-in team member, or a guest with a valid cookie) both GET and POST redirect to `whiteboards.show` (`:23-25,43-45`).

### 2. Props

| Prop | Type | Source |
|---|---|---|
| `isInvalid` | `true` | `:72` (alone) |
| `isInvalid` | `false` | `:28` |
| `guestToken` | string | `:29` |
| `boardTitle` | string | `:30` |
| `suggestedName` | string\|null | `:31` — name of the logged-in user (a logged-in user who is not on the team joins as a guest) |

Matches the TS union `join.tsx:10-17`. Shared props read: `translations` only (plus whatever `AuthLayout` reads).

### 3. Layout

`AuthLayout` (`resources/js/app.tsx:56-57`).

### 4. User actions

| Action | UI element | HTTP | Who |
|---|---|---|---|
| Choose a display name and join | `join.tsx:44-69` Inertia `<Form {...WhiteboardJoinsController.store.form(guestToken)}>`; input `name` (required, `maxLength=50`, autofocus, default `suggestedName`); button "Join" disabled while processing; `errors.name` shown via `InputError` | `POST whiteboards/join/{guestToken}` `whiteboards.join.store`; validation `name: required|string|max:50`; creates a `WhiteboardMember` (`guest_name`, `guest_secret_hash`), sets cookie `whiteboard_guest_{boardId}` (30 days) and redirects to `whiteboards.show` | anyone with a valid link |

### 5. Realtime

None.

### 6. Conditional UI / 7. Other state

- Invalid state: only a heading "Join a whiteboard" + "This guest link is no longer valid." (no form, no link) (`join.tsx:22-32`), served with status 404.
- Throttle 10/min on POST: a 429 is not specifically handled by the page.
- No hardcoded strings.

---

## Slice notes

### JSON (non-Inertia) endpoints called by the front in this slice

| Endpoint | Route name | Caller | Response used |
|---|---|---|---|
| `GET whiteboards/{board}/snapshot` | `whiteboards.snapshot.show` | `use-whiteboard.ts:71-73` (meta refetch), `scene-sync.ts:488-490` (full reload) | full snapshot |
| `GET whiteboards/{board}/elements?since=` | `whiteboards.elements.index` | `scene-sync.ts:587-591` | `{seq, elements}`; 409 handled |
| `PUT whiteboards/{board}/elements` | `whiteboards.elements.update` (`throttle:whiteboard-writes`) | `scene-sync.ts:438-441` | `{seq, fromSeq, rejected[]}` |
| `POST whiteboards/{board}/files` | `whiteboards.files.store` | `files.ts:43-48` (raw fetch) | status only |
| `GET whiteboards/{board}/files/{fileId}` | `whiteboards.files.show` | `files.ts:77-80` (raw fetch) | image blob |
| `PATCH whiteboards/{board}/settings` | `whiteboards.settings.update` | `board-menu.tsx:77-83`, `facilitator-bar.tsx:44-55` | 204 |
| `POST whiteboards/{board}/guest-token` | `whiteboards.guestToken.store` | `board-menu.tsx:216-220` | `{guestUrl}` ignored |
| `PUT whiteboards/{board}/facilitator` | `whiteboards.facilitator.update` | `board-menu.tsx:147-152`, `hand-over-dialog.tsx:61-65` | 204 |
| `PUT whiteboards/{board}/timer` | `whiteboards.timer.update` | `facilitator-bar.tsx:30-35` | `{timerEndsAt}` |
| `POST whiteboards/{board}/template` | `whiteboards.template.store` | `save-template-dialog.tsx:61-64` | 201 body ignored |
| `POST whiteboards/{board}/duplicate` | `whiteboards.duplicate.store` | `board-menu.tsx:96-98` | `{url}` |
| `DELETE whiteboards/{board}` | `whiteboards.destroy` | `board-menu.tsx:111-113` | 204 |
| `POST broadcasting auth` | (BroadcastAuthorizationsController) | Echo | presence signature |

All URLs come from Wayfinder (`@/actions/App/Http/Controllers/Whiteboards/*`, `WhiteboardJoinsController`); no hardcoded whiteboard URL in `resources/js`.

### Routes of the area with no front caller

None. All 15 routes under `whiteboards/…` are called. (`teams.whiteboards.store`, `workspaces.whiteboardTemplates.update/destroy` — board creation, template gallery and management — belong to the team/workspace slices: `components/teams/{whiteboards-section,new-whiteboard-dialog,whiteboard-templates-dialog,whiteboard-template-preview}.tsx`, `TeamWhiteboardsController`, `WorkspaceWhiteboardTemplatesController`.)

### Dead / unused code

- `RequiredApi` and `RequiredProps` types exported from `lib/whiteboard/excalidraw.ts:35-56` are imported nowhere (they list `renderTopRightUI` and `onScrollChange` props that the board does not pass).
- Re-exported types `AppState`, `BinaryFileData`, `Collaborator`, `SocketId` (`excalidraw.ts:15-22`) appear unused outside that file.
- `StickyColors` and `sceneFileName` are exported but only used in their own file (probably for tests).
- Snapshot fields never read by the front: `board.teamId`, `me.name`, `me.avatarUrl`. Responses never read: files store body, guest-token `guestUrl`, template `{id,name}`.
- All components and hooks of the slice are mounted/imported; no dead component.

### Leftover traces of the removed features (voting, private writing, version history)

**None found in code.** Checked: `resources/js/{pages/whiteboards,components/whiteboard,lib/whiteboard,hooks/use-whiteboard*}`, `app/{Actions,Events,Http/Controllers}/Whiteboards`, whiteboard models, the four whiteboard migrations (no `whiteboard_versions` table, no `last_versioned_seq`, no vote/private columns), routes, lang files (the only "Votes per participant" string belongs to retros). The only mentions are historical, in the spec `docs/superpowers/specs/2026-10-01-whiteboard-design.md` (§3 lines 28-29, §9 "(removed)", decisions 8-9 lines 347-348), which documents the removal. "version"/"versionNonce" in the code are Excalidraw's per-element conflict counters, unrelated to version history. Consequence stated by the spec: the canvas's own local undo/redo is the only way back.

### Surprises

- Any team member can "Take control" from an active facilitator at any moment; hand-over and take-control both switch follow-me off.
- "Replace the guest link" expels every current guest (secret hashes nulled); they land on the "access ended" screen at their next request (403).
- A logged-out visitor opening a guest-enabled board URL gets the retro slice's `retros/session-ended` page, not a whiteboard page.
- The whiteboard does not use the shared `LiveCursors` layer: cursors are Excalidraw collaborators fed by a whisper with scene coordinates. A rewrite reusing the retro cursor layer would change the wire format (`client-cursor` is shared by name with other boards but the payload differs).
- Whiteboard events are `toOthers`: the acting client must update itself (refetch after settings, `setTimer` from the response, `router.visit` after delete). A request sent without `X-Socket-ID` would echo back to the sender.
- The write throttle keys guests by IP, so guests behind one NAT share 20 writes/s per board.
- The author's canvas can keep fields the server stripped until reload (see §7 note).
- `ChunkBoundary` also swallows runtime render errors of the board, showing "The canvas could not be loaded."
- Clipboard write in `copyGuestLink` has no error handling.
- The 5-minute timer linger was flagged in the spec (line 336) as "not asked for by the user, to be confirmed or removed at review".

### Could not verify

- Exact wire shape of the `client-reaction` whisper beyond the `e` field (built inside the `live-reactions` package; not read).
- What Excalidraw 0.18.1 actually renders for parts left at library defaults: library sidebar button, the view-mode menu contents, whether the JSON export dialog shows other cards besides `renderCustomUI`, embeddable/web-embed tool availability (the server would refuse such elements as `invalid`). Not run in a browser.
- That `canvasActions.saveFileToDisk: false` really disables Ctrl+Shift+S (taken from the code comment at `excalidraw.ts:26-33`).
- `SanitizeWhiteboardElement.php` lines 125-369 were only skimmed (shape/number/binding validation details not inventoried).
- `PruneWhiteboardFiles`, `CopyWhiteboardScene`, `RemapWhiteboardScene`, `SaveWhiteboardTemplate`, `CreateWhiteboard` internals (duplicate/template copy path) not read in detail.
- `AuthLayout` shared-prop usage for the join page (sibling slice).
- No front-end unit tests for the whiteboard were found under `resources/js`; no file under `tests/Browser` mentions "whiteboard" by a case-insensitive grep, although the last merge message says whiteboards were added to the browser suite — not investigated.
