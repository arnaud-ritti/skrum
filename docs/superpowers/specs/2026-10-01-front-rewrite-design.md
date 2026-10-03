# Skrum — Front-end rewrite on the design system — Design

Date: 2026-10-01
Status: Design approved in conversation, awaiting spec review
Amended 2026-10-02: amendment A1–A9 of plan 18e (`research/front-rewrite/18e-spec-amendment.md`) is folded in, and the owner's answers of 2026-10-02 (`research/front-rewrite/owner-answers-2026-10-02.md`) are applied, both rounds: §6.1, §6.3, §6.4, §6.5 rulings 19 and 36 to 38, §7, §8, §9 B1–B3, B10, B12–B16 and the new B17–B45, §10, §12, §13 criteria 14 to 44, §15. The owner's standing rule "the mockup must be faithfully respected" is rule 13 of §5. Third round, same day: "rewrite first, features after" (rule 13, `research/front-rewrite/feature-roadmap.md`), four session types (the poll moves to plan 19), "+2 min" on every timer, workspace-level decks, a live rooms list, and the security answers on B31 and B33.
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

- A mockup element that needs a concept the product does not have at all, or that the owner sent to the backlog. These are not rendered. They are listed in §10 as backlog. An element whose data the server already holds is not in this case: it is built, with a §9 item (§5 rule 13).
- Changing realtime protocols, reducers or the JSON contracts of live pages, except for the two new retro phases.
- Recoding the Excalidraw toolbar. The whiteboard is themed, not rebuilt.
- Dark-mode screen mockups. None exist; dark rendering is judged on tokens and component previews.
- A landing page. A self-hosted instance has none: `/` redirects (B32). The ScreenLanding mockup is not built.

## 4. Decisions taken in conversation

| Topic | Decision |
|---|---|
| Inertia version | The repository is on Inertia v3. The rewrite stays on v3. |
| Existing Pest browser suite | It is a contract. The new front end keeps `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names. A test changes only when a mockup imposes another label or flow, in the commit of that screen. |
| Mockup elements without a back end | Built, with a §9 item, when the server holds the data. Out of scope and recorded in §10 when the product lacks the concept or the owner sent the element to the backlog (§5 rule 13). |
| Languages | `en`, `fr`, `es`, `de` stay complete. New keys are added to all four files. Visual captures run in FR and EN. |
| Migration strategy | In place, screen by screen. `app.css` and `components/ui` are replaced in phases 1 and 2; old pages run on them until rewritten in phase 5. There are never two versions of a component. |
| Containers | Per domain, in `resources/js/components/<domain>/`, plus `components/session/` for what the four live session types share (§6.1). No other new base folder. |
| Instance admin | The first registered user is the instance admin (already the case in the code) and can name others (new). |
| Magic link and e-mail 2FA code | Built in this project (phase 6). |
| ⌘K | Navigation, commands and content search (new route). |
| Column colours | `ColumnColor` is extended to the eight design-system colours. |
| GIF providers | Tenor stays supported by the existing proxy; attribution follows the active provider. |
| Health check phase | Stays as an optional first phase through the rewrite. The mockups omit it; removing it would lose a feature. Plan 19 turns the health check into a default survey template and removes the dedicated phase. **Done by plan 19** (`docs/superpowers/specs/2026-10-19-standalone-surveys-design.md`): the phase is gone; a health check is a team survey, run as a Poll or attached to a retro and answered from a header button, scored 1 to 5. |

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
13. **The mockup is the reference.** A screen follows its mockup faithfully: layout, placement, labels, component structure, states. Three things bound this rule.
    - The owner's written answers (`research/front-rewrite/owner-answers-2026-10-02.md`) stand as written, including the few that keep today's behaviour or send an element to the backlog.
    - Everything else follows the mockup. A browser test that contradicts the mockup changes, in the commit of its screen, and the plan lists it. When the mockup shows data that the server holds but does not expose, the prop or the route is added to §9 with a task; the element is not omitted.
    - The only deviations allowed are: a statement that would be false or unsafe (a label that states a wrong duration, a link to a page that does not exist); the accessibility rules of this section; and data or a concept the product does not have at all, which is then backlog (§10). Each deviation is a row of the "Deviations from the mockup" table of the plan, with its reason, for the owner to approve.

    - **Rewrite first, features after.** The rewrite delivers every existing screen faithful to its mockup with what the server already holds. A mockup element with no data is omitted and listed as a deviation; afterwards each such element becomes a feature with its own spec and plan (19, 20, …), in the order the owner sets (`research/front-rewrite/feature-roadmap.md`). A screen leaves the element's place: the region or slot it will occupy exists in the layout, empty, so that the feature is added without a new layout.

    Each screen task ends with a side-by-side comparison of its captures with the mockup's `preview.html`, in light and dark, at 390 and 1440, and lists the differences that remain.

## 6. Architecture

### 6.1 Folders

| Folder | Content | Rule |
|---|---|---|
| `resources/js/components/ui/` | Themed shadcn primitives | Replaced in place in phase 2 |
| `resources/js/components/skrum/` | Business components of the design system | Presentational only |
| `resources/js/components/<domain>/` | Containers per screen: `retro`, `poker`, `games`, `whiteboard`, `action-items`, `teams`, `workspaces`, `settings`, `auth`, `integrations`, `admin`, plus `session` (containers shared by the four live session types: shell, connection banner, expired-session banner, presence, timer alarm, live cursors, reaction engine, guest-join page). Error pages use `components/auth/`. | Wire hooks and `lib/*` to `skrum/` components. Old files in these folders are deleted in the commit that rewrites their screen. |
| `resources/js/layouts/` | `AppLayout`, `SessionLayout`, `SettingsLayout`, `AuthLayout`, `OnboardingLayout` | A page renders its own layout: the page, or the shell of its domain (`AdminShell`, `SettingsShell`, `SessionShell`), wraps the content in the layout and passes typed props (active entry, breadcrumbs, topbar actions, session slots). `app.tsx` returns no layout for these pages; the list is `resources/js/lib/page-layouts.ts` until every page is rewritten, after which `app.tsx` assigns no layout at all. Known cost: a layout is no longer kept mounted between two visits (the sidebar re-renders; its open state comes from the cookie). |
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

Sessions, Mood & ROTI and Members have no page today. They link to the matching section of `teams/show` (tab or anchor). No new route. The Mood & ROTI section shows the team trend of B23 above the health check statements. Dashboard is the current team's page: `/dashboard` redirects to it (B22).

A live session shows a lost connection as a full-width banner under the header ("Reconnecting…"), followed by one sentence per session type. The sentence "Your cards are kept locally and will be sent when the network returns." is shown only by a session type that queues unsent changes; none does today, so each type states what is true for it (retro and poker: live updates are paused and what is shown may be out of date; game room: the round may have moved on; whiteboard: other people's changes appear when the connection returns). The topbar keeps the compact connection state the ScreenErrors mockup shows, hidden from assistive technology so that the banner is the only announcement. An expired session is a banner with "Reload" over inert content.

### 6.4 Single models

- **Retro phases**: ~~Health check (optional) →~~ Icebreaker (optional) → Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed (session-end screen). The health-check phase is gone: plan 19 removed it (`docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` §11.4).
- **Poker**: one room, the oval table, with the story queue on the right and the deck at the bottom. Watch only and rounds are part of it. The facilitator's actions (Reveal cards, Re-vote, Estimate, Save estimate, Next task) are in the dock, as the mockup shows. The reveal button is named "Reveal cards".
- **Session creation**: one "New session" trigger; the type is chosen in the dialog among four: Retrospective, Planning poker, Whiteboard, Icebreaker (B18). The mockup's fifth type, Poll, arrives with the standalone survey of plan 19; the dialog leaves its place. Plan 19 has added it as the fifth tile (`docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` §9.1). The retro form shows five shortcut cards (the team's most used templates, B17) and "Browse", which opens the full template picker.
- **Guest link**: its controls (allow guests, copy, create a new link) live in the Share dialog only, on every session type; "Create a new link" asks for confirmation.
- **Discussion (retro)**: the topics list only. A topic is a group or a lone card; the list is sorted by votes. Each topic keeps the controls its card had on the board: comments, reactions, highlight, and its action items. No feature of the discussing board is lost; the columns view remains on the Board tab of the completed retro.
- **Destructive actions** ask for confirmation in a dialog: deleting an action item, removing a team member, revoking an invitation, deleting a session, a deck, a retro template or a whiteboard template, creating a new guest link. Deleting a workspace and leaving one ask for the typed name. Deleting a retro template says "Retros already created from it are not affected."
- **Team page sections**: the secondary entries of a section ("Saved decks" in Planning poker, "Whiteboard templates" in Whiteboards) are in the section's "…" actions menu, not buttons in its header.
- **Guest label**: a guest's name is followed by "(Guest)", with a capital, wherever the action-item components show an owner.
- **ReactionBar**: one bar, floating bottom centre or stacked above a panel with a `space-3` gap. It never overlaps another element, including the poker deck and the FacilitatorBar. Reaction chips on a card are another component.
- **Whiteboard**: Excalidraw with its native toolbar, themed per `ExcalidrawTheme/README.md` (CSS variables and the eight sticky colours). `WhiteboardToolbar` in `skrum/` is the theming wrapper and the colour bar that README describes, not a custom tool set. The colour bar is shown for every tool that has a fill; Excalidraw's native colour quick picks are hidden (its "more colours" picker stays). A sticky note has the palette border of its colour. The built-in templates use the eight colours (B29). Cursor colours come from the presence tokens. On a phone (below the `md` breakpoint) the board opens in read mode (Excalidraw's view mode: pan and zoom, no tool) with an "Edit" button ("Modifier" in French) that switches to edit mode and back; the mode is client state, is not stored, and never lets a non-facilitator edit a locked board. The existing DOM adjustments that target Excalidraw 0.18.1 internals must keep working.
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
| 14 | No second application sidebar. Instance administration has its own sub-navigation column inside the page, as ScreenSettings frame b shows: the sections that exist, the instance host and the self-host badge. The unsaved-changes bar is in the topbar. |
| 19 | Timer durations: one list on every screen, 1, 3, 5 and 10 minutes (retro, poker, game room, whiteboard). The old per-screen lists go (poker's 30 seconds and 2 minutes, the games' 2 minutes). Poker keeps its "Custom…" entry (1 to 60 minutes) beside the list. No pause. "+2 min" extends a running timer on the four session types (B20). At zero the timer shows `0:00` with an alarm icon and the accessible name "Time's up!". |
| 21 | Digits go to ROTI, health check or survey when their panel is active, otherwise to reactions. Letter shortcuts are scoped per session type; only one session type is on screen at a time. |
| 26 | In phase Actions the main facilitator action is "Next phase" (to ROTI). The session ends from ROTI. |
| 27 | ReactionBar, settings icon, back button and icon share are present in every retro phase. |
| 28 | FacilitatorBar takes a list of typed actions per phase, so every existing facilitator action has a slot. |
| 35 | The sidebar entry Games uses `PartyPopper`, as `Sidebar/README.md` says. The icebreaker module elsewhere uses `Sparkles`, as `sections/03-iconographie.md` says. |

Rulings added on 2026-10-02 from the owner's answers (no digest number):

| # | Ruling |
|---|---|
| 36 | Drawing ink (Draw & Guess) is the eight theme colours plus black (B26). The values are canvas data: literals in `lib/games/drawing.ts`, exempt from rule 1 of §5, as is the always-white paper of the whiteboard template preview. |
| 37 | Session-end screen: confetti is built in CSS (`animate-confetti` of `app.css`), without a dependency, and never plays with `prefers-reduced-motion`. |
| 38 | Action items page: "Group by" (team, assignee, status) is done on the client over the loaded page; the header shows one counter per status (B25); "New action item" is in the topbar. |

Components without a README (`SessionCard`, `StatCard`, `ColumnColorPicker`, `DeckEditor`, `Alert`, `Combobox`, `Kbd`, game UIs, survey builder, skeleton variants) are derived from the screen previews and the README that mentions them.

## 7. Page → mockup → components

Order is the order of phase 5.

| # | Pages | Mockup | Main `skrum/` components | Layout |
|---|---|---|---|---|
| 1 | The "New session" dialog of `teams/show` (four types); `poker/decks` (saved decks page, B21) | ScreenSessionCreate; ScreenPokerQueue (Saved decks) | SessionTypePicker, RetroTemplatePicker, DeckPicker, DeckEditor | App |
| 2 | `retros/show`, `retros/join`, `retros/session-ended` | ScreenRetroWriting, Grouping, Vote, Discussion, Actions, ROTI; MobileRetro | RetroColumn, RetroCard, CardGroup, VoteDots, PhaseStepper, FacilitatorBar, Timer, SessionSettingsPopover, ReactionBar, PresenceStack, LiveCursor, ConnectionState, ActionItem, ROTIWidget, HealthCheck, GifPicker, ShareDialog, GuestJoin | Session |
| 3 | `poker/show`, `poker/join`, `poker/estimates` | ScreenPokerBefore, After, Queue; MobilePoker | PokerTable, PokerCard, DeckPicker, Timer, ReactionBar | Session, App |
| 4 | `teams/show` | ScreenDashboard, ScreenTeam; MobileDashboard | EmptyState, MoodTrendChart, HealthCheck (statements), ActionItem | App |
| 5 | `action-items/index` | ScreenActions | ActionItem | App |
| 6 | `games/index`, `games/show`, `games/join` | ScreenIcebreaker, Draw, Emoji, Gif; MobileRituals | IcebreakerGameCard, GamesLeaderboard, GifPicker, ReactionBar, ShareDialog | App, Session |
| 7 | `whiteboards/show`, `whiteboards/join` | ScreenWhiteboard | WhiteboardToolbar, ReactionBar, PresenceStack | Session |
| 8 | Surveys inside the retro | ScreenSurvey | SurveyQuestion | Session |
| 9 | `workspaces/show`, `create`, `members`, `templates` | ScreenWorkspace | TemplateEditor, RetroTemplatePicker | App |
| 10 | `settings/*` (5), `teams/integrations` (Admin › Branding was built in plan 18d) | ScreenSettings, ScreenUserSettings, ScreenSecurity | AvatarStylePicker | Settings |
| 11 | `auth/*` (7), `invitations/show`, error pages | ScreenAuth, ScreenOnboarding, ScreenErrors; MobileAccess | GuestJoin, EmptyState | Auth, Onboarding |
| 12 | `/` — no page: a redirect (B32); `welcome` is deleted | none (ScreenLanding is not built) | none | none |

Notes on the rows: the "New room" dialog of `games/index` belongs to row 6. Each guest-join page is rewritten with its session group (rows 2, 3, 6, 7) on the shared `GuestJoinPage` of `components/session/`; `retros/session-ended` belongs to row 2.

Designed from neighbouring mockups, because no mockup exists:

- `workspaces/members`, `workspaces/create`: from ScreenWorkspace and ScreenTeam.
- `teams/integrations`: from ScreenSettings, as a section of the sub-navigation.
- ~~Health check phase of the retro: HealthCheck inside the ScreenRetro frame.~~ Removed by plan 19 (`docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` §11.4).
- Results and insights of a completed retro: inside the session-end screen of ScreenRetroROTI.
- `auth/confirm-password`, `verify-email`, `reset-password`, `two-factor-challenge`: from ScreenAuth.
- Whiteboard templates: stay managed from the team page, and are listed on the Whiteboard tab of `workspaces/templates` (B30).
- `poker/decks`: from the Saved decks page of ScreenPokerQueue.

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

Features of the old front end that the owner's answers of 2026-10-02 change or remove; the parity table records them as decided, not as losses:

- The three creation triggers of the team page become one "New session" trigger.
- Poker's 30-second and 2-minute timer presets and the games' 2-minute preset go (ruling 19).
- The Saved decks dialog of the team page becomes the page `poker/decks`.
- The guest-link entries of the board, game and room menus move into the Share dialog.
- The columns view of the Discussing phase is replaced by the topics list (§6.4).
- The "Add survey" button of the board moves into the settings popover.
- The `welcome` page is replaced by a redirect.

## 9. Back-end changes

Each item is approved by this spec once the spec is approved. Nothing else on the back end changes.

| # | Change | Phase |
|---|---|---|
| B1 | `RetroPhase` gains `Actions` and `Roti` between `Discussing` and `Completed`. Neighbour rule, `Retro::phases()`, guards, visibility rules, `phase` payloads, TS types and reducer updated as the matrix of §9.1 says. Open retros in `discussing` move forward through the new phases; completed retros are unchanged. | 5.2 |
| B2 | ROTI is collected in phase `roti`, and no longer in `discussing`. It stays readable in `completed`. A boolean column `retros.roti_votable_when_completed` (default `false`) marks the retros that were already completed when B2 was deployed: the migration that adds the column sets it to `true` where `phase = 'completed'`. ROTI voting is allowed in phase `roti`, and in `completed` only when the column is `true`. The board snapshot's `roti` object gains `canVote: bool` so the front end shows the vote control or the result only. A legacy retro that is reopened and completed again keeps the mark. | 5.2 |
| B3 | Session-end screen: `completed` already serves results and the recap e-mail. `results.stats` is added to the completed snapshot: `votesCast` (number of votes), `votesAvailable` (participants × the vote limit), `participation` (`participants`: everyone who joined the retro, team members, guests and people outside the team alike; `expected`: the members of the team at completion plus the participants who are not members of the team, so a guest counts on both sides and the figure never exceeds the whole (owner decision of 2026-10-02, sixth round: "a guest counts in the participants"; it replaces the amendment made at the close of plan 18e, which left guests out because "people who joined" against the team size read "3 of 2 · 100%")) and `durationSeconds` (B19; `null` for a retro without a start time, in which case no duration is shown). Cards, groups and action items are counted on the client from data already sent. Each statement of `results.health` gains `previousAverage`: the average of the same statement in the team's previous completed retro with a health check, or `null`. | 5.2 |
| B4 | Instance settings: table `instance_settings`, cache, and an Admin area with routes and a policy. Sections: Branding, Admins. `users.is_instance_admin` already exists and the first registered user (form or SSO) already receives it; nothing changes there. New: admins can grant and revoke the flag from Admin › Admins; the last admin cannot be revoked. | 4 |
| B5 | `App\Support\Branding\BrandPalette` from `docs/design-system/php/BrandPalette.php`, adapted to the project's PHP guidelines, plus `toHex()`. `<style id="skrum-brand">` is injected after `@vite` in `app.blade.php`. | 4 |
| B6 | Branding settings: colour, light and dark logos, favicon, radius (0–16px), display name, "Powered by Skrüm" toggle, DiceBear avatar style with "members can choose" (`users.avatar_style`, nullable), GIF provider key and enable switch. Environment variables stay as defaults when no setting is stored. Default GIF rating becomes `g`. | 4 |
| B7 | CC BY attribution for the active avatar style on an "About" screen reachable from the user menu. | 4 |
| B8 | Local-only route `/dev/design-system`. | 1 |
| B9 | `auth.user.avatarUrl` in shared props. Today the page reads `auth.user.avatar`, which is never sent, so the signed-in user always sees initials. | 1 |
| B10 | `ColumnColor` becomes `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss`. Data migration for `columns` and `workspace_template_columns`: green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris. The built-in template catalogue (52 templates) and the factories use the new values. The board snapshot, the `columns.changed` event and the template props emit the new values. The column and workspace-template endpoints reject the six old values with a validation error. No MCP tool, webhook or export carries a column colour. The built-in whiteboard templates are scene data, not `ColumnColor`; they change under B29. | 5.2 |
| B11 | Search route for ⌘K: `GET /search?q=` returns retros, poker games, whiteboards, game rooms and action items whose title or content matches, limited to teams the user can view, throttled, minimum two characters. | 6 |
| B12 | Magic-link login: request by e-mail, signed single-use link valid 15 minutes, token stored hashed, resend cooldown of 60 seconds, throttled per e-mail (at most five links per hour per address) and per IP, same response whether or not the address exists. The link opens a confirmation page and signs in the device that opens it, which may be another device than the one that asked. The session it opens is a normal session, without a long-lived "remember" cookie. Offered to every verified account; no link is sent to an unverified account. A user with a second factor is still challenged. Not offered, and refused by the server, while the instance setting `sso_required` is in force (B33). | 6 |
| B13 | E-mail code as a second factor: a user enables it in Security; at the challenge a 6-digit code valid 10 minutes is sent, stored hashed, with a 60-second resend cooldown, at most five codes per hour per address, and a limit of five attempts. The code e-mail states the browser and the time of the request, not a location. TOTP and passkeys are unchanged; recovery codes too, except that a used one is removed (B43). | 6 |
| B14 | E-mails as Mailables per `components/Emails/README.md`, light and dark, plain Blade, using `BrandPalette::toHex()`: magic link, invitation, action reminder, retro recap, 2FA code. The three existing notifications keep their triggers. Their recipients are unchanged, with one exception: the retro recap is not sent to a user whose preference `recap_emails` is off (B34). The recap and the action reminder carry a signed unsubscribe link and the one-click unsubscribe headers; the security mails (magic link, code, invitation) carry none. | 6 |
| B15 | Custom error pages. 403, 404, 419, 429 and 500 are Inertia pages on the design system, rendered by the exception handler: 419 offers "Reload", 429 says when to retry when the response carries `Retry-After`. 503 is a static Blade view (`resources/views/errors/503.blade.php`): inline styles taken from the design tokens, the default brand, no script, and no access to the database, the cache or the session, so that it serves `php artisan down` and any other 503. The handler leaves JSON requests untouched (`expectsJson()`), so the JSON endpoints of the live pages and the MCP server keep their status codes and bodies. The 500 page renders without database-backed shared props and shows the request id (B36). In debug mode 500 keeps the framework page. | 5.11 |
| B16 | Shared props for the team-centred sidebar: `currentTeam` (`id`, `name`, `membersCount`, or null) and `teams` (`id`, `name` of the teams of the current workspace visible to the user). The current team is the `team` route parameter when present; otherwise the last team visited, remembered in the session; otherwise the first visible team by name. Page props named `teams` with another shape are renamed: `teamGroups` on `settings/api-tokens` (in the preparation task of plan 18e, because the new sidebar reads the shared `teams`) and `filterTeams` on `action-items/index` (with its screen). | 1, 5 |
| B17 | `teams/show`: `topTemplates`, the team's five most used retro templates, with a fixed fallback (§9.2). | 5.1 |
| B18 | `teams/show`: props for the session type Icebreaker (§9.2). The Poll type is plan 19 (built: `docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` §9.1). | 5.1 |
| B19 | `retros.started_at` and the duration of the session-end statistics (§9.2). | 5.2 |
| B20 | "+2 min" extends a running timer: retro, poker, game room, whiteboard (§9.2). | 5.2, 5.3, 5.6, 5.7 |
| B21 | Saved decks page: route, default deck, duplicate, usage count (§9.2). | 5.1 |
| B22 | `/dashboard` redirects to the current team's page (§9.2). | 5.4 |
| B23 | `teams/show`: `moodTrend`, the team's mood and ROTI across its last retros (§9.2). Since plan 19 the mood is read on the health scale of 5 and counts the health checks run as surveys (`docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` §11.5, §11.9). | 5.4 |
| B24 | `teams/show`: `avatarUrl` on `members` and `availableMembers` (§9.2). | 5.4 |
| B25 | `action-items/index`: `counts` per status (§9.2). | 5.5 |
| B26 | Drawing ink: black and the eight theme colours; old drawings keep theirs (§9.2). | 5.6 |
| B27 | Live reactions in standalone game rooms: `game_rooms.reactions_enabled` (§9.2). | 5.6 |
| B28 | `games/index`: `status` and `players` on each room, live through a team-level games channel (§9.2). | 5.6 |
| B29 | The eight built-in whiteboard templates are regenerated with the eight sticky colours (§9.2). | 5.7 |
| B30 | Workspace-level decks; `workspaces/templates`: data of the Poker and Whiteboard tabs; "Use" (§9.2). | 5.1, 5.9 |
| B31 | `invitations/show`: `ssoProviders`; accepting an invitation through SSO (§9.2). | 5.11, reviewed in 6 |
| B32 | `/` redirects; the landing page is removed (§9.2). | 5.12 |
| B33 | Instance setting `sso_required` (§9.2). | 6 |
| B34 | User preference `recap_emails` and the signed unsubscribe link of the recap e-mail (§9.2). | 6 |
| B35 | Shortcuts `G`, `F`, `C`, `⇧R`, `⌘→` and the user preference `single_key_shortcuts` (§9.2). | 6 |
| B36 | A request id per request, written to the log and shown on the 500 page (§9.2). | 5.11 |
| B37 | Session creation: options the mockup shows and the server can already store (§9.3). | 5.1 |
| B38 | Retro: who has written, who has voted on ROTI (§9.3). | 5.2 |
| B39 | Poker: median, spread, agreement and outliers of a revealed round (§9.3). | 5.3 |
| B40 | Estimation history: deck and voters of each row (§9.3). | 5.3 |
| B41 | Team page: template, facilitator and ROTI of each retro; players in the room of each game (§9.3). | 5.4 |
| B42 | Workspace page and switcher: member and team counts, roles, template authors (§9.3). | 5.9 |
| B43 | Security page: date of the second factor, recovery codes left (§9.3). | 5.10 |
| B44 | Invitation page: inviter, role, expiry, members (§9.3). | 5.11 |
| B45 | Guest-join pages: facilitator, people who joined, whether the session is live (§9.3). | 5.2, 5.3, 5.6, 5.7 |

B12, B13, B31 and B33 are authentication changes. Their plan includes a security review step before merge; B31's props and buttons are built in plan 18e; its one change to the sign-in code (an unverified SSO address is refused even with an invitation) is plan 18f work, under its security rules.

Known limit of B12 with B13: a magic link followed by an e-mail code proves control of the same mailbox twice. This is accepted and stated on the Security screen. The e-mail code is accepted as a second factor for everyone, instance admins included; a user whose only second factor is the e-mail code has no recovery codes.

### 9.1 B1 — what is allowed in phases `actions` and `roti`

Principle: `actions` behaves like `discussing` for everything that touches cards and action items. `roti` is a rating step: the board is read-only, action items stay editable on the server so there is no phase in which an open retro's items cannot be ticked. The ROTI screen itself lists no action item, as the mockup: the items are ticked from the action items page, or on the board after "Previous". Surveys are unchanged.

| Capability | Guard (file) | discussing | actions | roti | completed |
|---|---|---|---|---|---|
| Neighbour rule | `Retro::phases()`, `canMoveTo()` | … ↔ discussing ↔ actions | ↔ roti | ↔ completed | Reopen lands on `roti` |
| Vote totals visible | `Retro::showsVoteTotals()` | yes | yes | yes | yes |
| Highlight a card, presentation mode | `RetroHighlightsController` | yes | yes | no | no |
| Highlight kept when the phase changes | `ChangeRetroPhase::move()` | kept between `discussing` and `actions`; cleared on any other move | | | |
| Action items: create, update, delete, sub-tasks, comments (board routes) | `LocksDiscussingRetro::guardDiscussing()` | yes, unless locked | yes, unless locked | yes, unless locked | no (workspace routes, as today) |
| MCP `CreateAction`, `UpdateAction` | `app/Mcp/Tools/Retro/CreateAction.php`, `UpdateAction.php` | yes | yes | yes | as today |
| Suggested actions: promote, reject | `SuggestionGuard` | anyone, unless locked | as discussing | as discussing | facilitator or admin |
| Insights readable | `BuildInsights`, MCP `ListInsights` | yes | yes | yes | yes |
| Group naming | `RetroGuard::groupNaming()` | yes | yes | no | no |
| Card reactions | `CardReactionsController` | yes | yes | no | no |
| Card comments | `CardCommentsController` | yes | yes | no | no |
| Surveys answerable, creatable | `SurveyGuard::activePhase()` | yes | no (unchanged) | no (unchanged) | no (closed on completion, as today) |
| ROTI vote and retract | `RetroRotiController` | no (was yes) | no | yes | only for the retros marked by B2 |
| MCP `GetRoti` | `GetRoti.php` | not available (was "pending") | not available | "pending" | results |
| Timer, settings, lock, guest link, hand-over, delete | guards based on `RetroPhase::isOpen()` | yes | yes | yes | as today |
| Cards: write, edit, move, group, vote | guards naming `writing`, `grouping`, `voting` | as today | no | no | no |
| Live cursors (front rule `showsCursors`) | `components/session` container | on | on | off (a pointer on a score reveals a vote, as in voting) | off |
| Flying reactions (front rule) | retro container | on | on | on | on: the bar is docked under the results of the session end (owner, 2026-10-02, D-112). They stay whispers, never stored: the board itself stays read-only |

`LocksDiscussingRetro` keeps its name in plan 18e (the rename is left to 18g); it reads a new `RetroPhase::takesActionItems(): bool` (`Discussing`, `Actions`, `Roti`).

Public payloads: the `phase` value and the `phases` list of the board snapshot, of `TeamsController` (`phase`, `phaseLabel`) and of the MCP board presenter (`McpBoard`) gain `actions` and `roti`. No webhook or outgoing payload carries a phase. The MCP server instructions and the three tool descriptions that say "only while the board is in the Discussing phase" are reworded. `RetroPhase::label()` returns `__('Actions')` and `__('ROTI')`.

Data: no migration for B1. `retros.phase` is a string; a retro in `discussing` gets two more steps. A retro in `discussing` that already holds ROTI votes keeps them and can change them in `roti`.

Consequence accepted: a survey still open when the facilitator leaves `discussing` can no longer be answered; it is closed, and its results shown, on completion as today.

### 9.2 B17 to B36 — items added by the owner's answers of 2026-10-02 (§9.3 holds B37 to B45, added by rule 13)

Each item gives what changes, who may do it, and its acceptance criterion in §13. They follow the conventions already in the code: actions in `app/Actions/<Domain>`, one controller per resource with CRUD method names, policies through `Gate::authorize`, guards (`RetroGuard`, `GameGuard`) on the live JSON endpoints, events sent to others only, UUID keys, migrations with `up` only.

**B17 — the team's most used retro templates.** `teams/show` gains `topTemplates: string[]`: exactly five catalogue keys (a built-in key, or `workspace:{id}` for a workspace template), computed by a new action `App\Actions\Retros\TopTeamTemplates`. Order: the templates of the team's existing retros by number of retros, most used first (ties: most recently used first), counting `retros.template` for built-in templates and `retros.workspace_template_id` for workspace templates that still exist; the `custom` (blank) template is never counted. The list is then completed, in order and without duplicates, from the fixed fallback `TemplateCatalogue::Shortcuts` = `went_well_to_improve_actions`, `start_stop_continue`, `four_ls`, `sailboat`, `mad_sad_glad`. One grouped query, sent with the page (not deferred). Authorisation: that of the page (`view` on the team); the keys are a subset of the catalogue the same user receives. No route, no event. Criterion 14.

**B18 — session type Icebreaker.** `teams/show` gains `gameOptions` (the shape `games/index` already receives, from `GameRulesRegistry::options()`), `canCreateGameRoom` (the `createGameRoom` ability and fewer than `GameRoom::MaxRoomsPerTeam` rooms) and `roomLimit`. The Icebreaker type posts to the existing `teams.games.store` (`name`, `game`, `access`) and opens the room. Authorisation: `createGameRoom`, as the endpoint checks today. The dialog offers four types; Poll is a standalone survey, specified apart in plan 19, and nothing of it is built here. Criterion 15.

**B19 — retro start time and duration.** Migration: `retros.started_at` (nullable timestamp, no backfill). A new action `App\Actions\Retros\MarkRetroStarted` sets it once (`update … where started_at is null`) at the first activity: a card is created, a health-check answer is saved, the timer is started, or the phase changes (confirmed by the owner). `results.stats.durationSeconds` (B3) is `completed_at − started_at` in seconds, or `null` when `started_at` is null; retros that existed before the migration and never see one of the four events again show no duration. A reopened retro keeps its `started_at`. No route, no event, no authorisation change. Criterion 16.

**B20 — "+2 min".** Four routes, one per session type, each without a body, each adding 120 seconds to a running timer inside the same locked transaction as the timer's `update`, broadcasting the type's existing timer event to others, and answering `{ timerEndsAt }`. Each answers 422 with an error on `timer` when no timer is running (null or already past) or when the remaining time would exceed the maximum its `update` accepts. The expiry jobs need no change: each job belongs to one end time and does nothing when the stored end differs, so an extension schedules a new job and the old one becomes a no-op.

| Session | Route (name) | Controller | Guards | Maximum | Event | Expiry |
|---|---|---|---|---|---|---|
| Retro | `POST retros/{retro}/timer/extension` (`retros.timer.extension.store`) | `Retros\RetroTimerExtensionsController@store` | `RetroGuard::facilitator`, `RetroGuard::open` | 7 200 s | `TimerChanged` | `ScheduleIcebreakerExpiry`, as `update` |
| Poker | `POST poker/{game}/rounds/{round}/timer/extension` (`poker.rounds.timer.extension.store`) | `Poker\PokerTimerExtensionsController@store` | `PokerGuard::notEnded`, `facilitator`, `openRound` | 3 600 s | `PokerTimerChanged` | a new `RevealPokerRoundOnTimer` for the new end |
| Game room | `POST games/{room}/timer/extension` (`games.timer.extension.store`) | `Games\GameTimerExtensionsController@store` | `GameGuard::standalone`, `GameGuard::host` | 7 200 s | `GameTimerChanged` | `ScheduleRoundExpiry` when a round is active |
| Whiteboard | `POST whiteboards/{board}/timer/extension` (`whiteboards.timer.extension.store`) | `Whiteboards\WhiteboardTimerExtensionsController@store` | `WhiteboardGuard::facilitator` | 3 600 s | `WhiteboardTimerChanged` | none (the board has no expiry job) |

An icebreaker room inside a retro has no timer of its own: the retro's route extends it. Criterion 17.

**B21 — saved decks page.** Migration: `teams.default_poker_deck` (nullable string, a built-in `PokerDeck` value other than `custom`), `teams.default_saved_poker_deck_id` (nullable foreign UUID to `poker_decks`, null on delete), `poker_games.saved_deck_id` (nullable foreign UUID to `poker_decks`, null on delete), not backfilled: usage counts start from the change. Routes, in the team group next to the existing `teams.pokerDecks.*`:

- `GET …/teams/{team}/poker-decks` (`teams.pokerDecks.index`, `PokerDecksController@index`) renders `poker/decks` with `workspace`, `team`, `builtInDecks` (`key`, `name`, `cards`, `isDefault`, `usageCount`), `savedDecks` (`id`, `name`, `cards`, `isDefault`, `usageCount`, `canManage`), `canCreate`, `canSetDefault`, `deckLimit`. Authorisation: `viewAny` of `PokerDeckPolicy`.
- `PUT …/teams/{team}/default-poker-deck` (`teams.defaultPokerDeck.update`, `TeamDefaultPokerDecksController@update`) takes either `deck` (built-in value) or `saved_deck_id` (a deck of the team), never both; it writes one column and clears the other. Authorisation: `update` on the team.
- `POST …/teams/{team}/poker-decks/{pokerDeck}/duplicate` (`teams.pokerDecks.duplicate.store`, `PokerDeckDuplicatesController@store`) copies the cards under the name "Copy of :name", cut to 40 characters and suffixed with a number while the name is taken. Authorisation: `create` of `PokerDeckPolicy`; the team's deck limit applies. Duplicating a built-in deck posts its cards to the existing `teams.pokerDecks.store`.

`CreatePokerGame` and `PokerSettingsController` write `saved_deck_id` when a game takes a saved deck and clear it otherwise. `usageCount` is the number of the team's games with that `saved_deck_id` (saved deck) or that `deck` value (built-in). `teams/show` gains `defaultPokerDeck` (`{ deck: ?string, savedDeckId: ?string }`), which the new-game form preselects; with no default the first built-in deck is preselected, as today. Deleting the default saved deck clears the default. No event. Criterion 18.

**B22 — `/dashboard`.** `CurrentWorkspaceController@show` resolves the workspace as today, then redirects to `teams.show` of the current team: the team remembered in the session (`current_team_id`, B16) when the user can still see it in that workspace, otherwise the first visible team by name. With no visible team it redirects to `workspaces.show`, and with no workspace to `workspaces.create`, as today. Authorisation unchanged (`auth`, `verified`). Criterion 19.

**B23 — team mood and ROTI trend.** `teams/show` gains the deferred prop `moodTrend` (a list, oldest first, of at most the eight last completed retros of the team that have a health-check score or a ROTI vote): `retroId`, `title`, `completedAt`, `url`, `mood` (the health-check score computed as `BuildHealthTrend` does, or `null`), `moodVoters`, `roti` (average on 1 to 5, one decimal, or `null`), `rotiVoters`. New action `App\Actions\Teams\BuildTeamMoodTrend`, Mood is the health-check score; ROTI is shown beside it. Built on the computation of `BuildHealthTrend` and on `withAvg` / `withCount` of `rotiVotes`. The page shows a skeleton while the prop loads. Authorisation: `view` on the team; guests never see it (the page requires an account). Criterion 20.

**B24 — member avatars.** Each entry of `members` and `availableMembers` on `teams/show` gains `avatarUrl` (`User::avatarUrl()`). Criterion 21.

**B25 — action item counters.** `action-items/index` gains `counts`: `open`, `overdue` (open with a due date in the past), `completed`, `mine` (open and assigned to the viewer) and `rituals` (number of distinct retros the counted items come from), computed with the page's filters except the status filter and with the same visibility rules as `items`. It is evaluated lazily like `items` and reloaded with it. Criterion 22.

**B26 — drawing ink.** Eight theme colours plus black (confirmed by the owner). `DrawingOp::Colors` becomes `black`, `sun`, `apricot`, `coral`, `plum`, `iris`, `sky`, `lagoon`, `moss` and `white` (the eraser). The five old names `red`, `orange`, `green`, `blue`, `purple` move to `DrawingOp::LegacyColors`: `parse()` still accepts them, the front end still renders them with their old RGB values, and the toolbar no longer offers them. Stored drawings are not migrated. The RGB values of the eight new colours are the light-theme values of the `--skrum-col-*-text` tokens, written as literals in `lib/games/drawing.ts`; the sheet stays white in dark mode. Authorisation unchanged (the drawer of the round). Criterion 23.

**B27 — live reactions in standalone game rooms.** Migration: `game_rooms.reactions_enabled` (boolean, default `true`). `PATCH games/{room}` accepts `reactions_enabled` for a standalone room (prohibited for an icebreaker room, which uses its retro's bar); the snapshot's `room` gains `reactionsEnabled`; the existing `GameRoomChanged` carries the change. Reactions themselves are client events on the room's presence channel, as on the three other session types: no route and no server event. Authorisation: `GameGuard::manager` to change the setting; any player of the room, guests included, sends and receives. Criterion 24.

**B28 — rooms list.** Each entry of `rooms` on `games/index` gains `status` (`playing` when the room has an active round, otherwise `waiting`) `players` (the first five players by join order: `id`, `name`, `avatarUrl`) and `roundStartedAt` (start of the active round, or `null`); `playersCount` stays. The mockup's "needs n more players" is not built: no game has a minimum number of players. The list is live. A new private channel `team-games.{teamId}` (named after the existing `team-action-items.{teamId}`) is authorised in `BroadcastAuthorizationsController` for a signed-in user who can `view` the team, and for nobody else: a guest of a room cannot listen to it. Two new events on it, sent to others: `TeamGameRoomChanged` (`team.game-room.changed`, payload = the room's summary as `PresentGameRoomSummary` builds it, which holds nothing viewer-specific and no secret of a round) and `TeamGameRoomDeleted` (`team.game-room.deleted`, payload `roomId`). They are dispatched for standalone rooms only, when a room is created, renamed, switched to another game or deleted, when a round starts or ends, and when a player joins. Authorisation of the page: `view` on the team. Criterion 25.

**B29 — built-in whiteboard templates.** The eight files of `resources/whiteboard-templates/` are regenerated: every sticky fill moves to the palette (`#fff3bf`→`#fdf1c2` sun, `#ffd8a8`→`#ffecdd` apricot, `#ffc9c9`→`#ffebe8` coral, `#d0bfff`→`#efeeff` iris, `#a5d8ff`→`#e2f3ff` sky, `#b2f2bb`→`#e1f8dc` moss) and takes the palette border of its colour as stroke instead of `transparent`. Boards already created, workspace templates and duplicates keep their colours. No migration, no route. Criterion 26.

**B30 — workspace-level decks and the workspace templates page.**

*Workspace decks.* A saved deck is owned by a team, as today, or by a workspace. Migration: `poker_decks.workspace_id` (nullable foreign UUID, cascade on delete) and `poker_decks.team_id` becomes nullable; exactly one of the two is set (a check in the model's rules and, on PostgreSQL, a check constraint); a unique index on `(workspace_id, lower(name))` beside the existing team one. A workspace deck is listed for every team of its workspace: `SavedPokerDeckRules::findForTeam()` accepts it, the deck lists of `teams/show`, of `poker/decks` and of the game settings include it, each deck carrying `scope` (`team` or `workspace`), and a team may take one as its default (B21). Routes, in the workspace group next to `workspaces.whiteboardTemplates.*`: `POST workspaces/{workspace}/poker-decks`, `PATCH …/{pokerDeck}`, `DELETE …/{pokerDeck}` (`workspaces.pokerDecks.store|update|destroy`, `WorkspacePokerDecksController`), with the rules of the team routes and a limit of `SavedPokerDeckRules::MaxDecks` per workspace. Authorisation, in `PokerDeckPolicy`: any member of the workspace sees and uses a workspace deck; only a workspace manager (`canManage`, the people who manage templates) creates, edits or deletes one; a team deck is unchanged. Deleting a workspace deck does not change the games that copied it and clears the defaults that pointed to it.

*Templates page.* The Retro tab is the full template picker: the built-in templates (read-only, with "Use" and "Duplicate" into the workspace, confirmed by the owner) and the workspace's own, with search and categories, from the `catalogue` prop the page already receives. `workspaces/templates` gains `whiteboardTemplates` (`id`, `name`, `description`, `preview`, `canManage`: the workspace's whiteboard templates) and `pokerDecks` (the workspace's decks: `id`, `name`, `cards`, `usageCount`, `canManage`). Each workspace retro template gains `author` (name of its creator, or `null`). The page has three tabs: Retro, Poker, Whiteboard. "Use" visits `teams.show` of the current team with the query `new=retro|poker|whiteboard` and `template=<catalogue key>` or `deck=<deck id>`; the team page opens the "New session" dialog on that type and choice. "Use" is disabled when the user has no current team. Managing a whiteboard template uses the existing `workspaces.whiteboardTemplates.update` and `.destroy`. Authorisation: the page's access is unchanged; `canManage` follows `WhiteboardTemplatePolicy` and `PokerDeckPolicy`; creation of a session is authorised by the team page and its endpoints. Criterion 27.

**B31 — SSO on the invitation page.** `invitations/show` gains `ssoProviders` (`SsoProvider::options()`; an empty list when the visitor is signed in or the invitation is invalid or expired). The buttons link to `sso.redirect`. The flow behind them exists: the page stores the token in the session and sets the intended URL; `SsoCallbacksController` passes the invitation to `ResolveSsoUser`, which creates the account and accepts the invitation when the SSO e-mail matches it, and the sign-up gate applies otherwise; an existing account returns to the invitation page and accepts with the button.

One rule of that flow changes, by the owner's security answer: an SSO address that the provider does not mark verified is refused, even with a matching invitation (today `ResolveSsoUser` accepts it and creates a verified account). This is a change to the sign-in code.

Ownership. Plan 18e owns the prop, the buttons and the feature tests that pin the flow as it stays (verified address with an invitation, another address, an existing account, the second factor); it changes none of `ResolveSsoUser`, `SsoCallbacksController`, `SignupGate`, and writes no test on the unverified case. Plan 18f owns the change in `ResolveSsoUser` and its tests, under its security rules and inside its security review. Until plan 18f lands, the unverified case behaves as it does today, on the login page as on the invitation page; the buttons of plan 18e add no path that does not already exist. Criterion 28.

**B32 — `/`.** `GET /` (route name `home` kept) redirects a guest to `login` and a signed-in user to `dashboard`. The `welcome` page and its `canRegister` prop are deleted. Criterion 29.

**B33 — instance setting `sso_required`.** New `InstanceSettingKey::SsoRequired = 'sso_required'` (boolean, default `false`), edited in a new section Admin › Sign-in (same policy as the Admin area of B4). It can be turned on only when at least one `SsoProvider` is enabled. The setting is in force when it is stored as true and at least one provider is enabled.

While in force, only SSO signs in: the login page shows the SSO buttons (no password form for ordinary users, no "Forgot password", no magic link, no passkey, no "Register"); the invitation page offers SSO only; and the server refuses password login, passkey login, form registration, password-reset requests and magic-link requests (the magic-link request keeps its neutral response and sends nothing).

Two ways back in, both kept. First, an instance admin can always sign in with password and second factor: the login page keeps a link "Sign in as an administrator" to the password form, and the server accepts the password of a user whose `is_instance_admin` is true, then requires the second factor; an admin without a confirmed second factor is refused this way and must use SSO. Second, when no provider is enabled the setting is ignored for everyone, and every instance admin sees an alert in the application ("SSO is required but no provider is enabled: password sign-in is open again.") until a provider is enabled or the setting is turned off.

The second-factor challenge after SSO is unchanged; sessions already open are not closed; guests of a session are not concerned. Criterion 30.

**B34 — user preference `recap_emails`.** Migration: `users.recap_emails` (boolean, default `true`). `RetroResultsRecipients::query()` excludes users whose preference is off, so the recipient counts of the send dialog follow. Settings › Notifications gains the switch, saved with the page's Save. The recap e-mail carries a signed unsubscribe link and the one-click headers, with the same mechanism as the reminder unsubscribe of the same plan: `GET` shows a confirmation page and changes nothing, `POST` turns `recap_emails` off for the signed user only, and neither signs anyone in. Criterion 31.

**B35 — shortcuts and user preference `single_key_shortcuts`.** Migration: `users.single_key_shortcuts` (boolean, default `true`), shared with the page through `auth.user`; a guest holds the same preference locally (`use-local-preference`). The switch is in an "Accessibility" card of Settings › Appearance (confirmed by the owner). When it is off, every shortcut made of one character key without `⌘` or `Ctrl` is inactive (letters, digits, `?` included, `/`, and `⇧R`); `Esc`, `↵`, the arrows and the `⌘` / `Ctrl` combinations stay. New handlers, each on an existing control, never active while a field is being edited, and listed by KeyboardShortcuts (`?`):

| Shortcut | Where | Does |
|---|---|---|
| `G` | retro, Grouping | starts the keyboard move of the focused card, as its drag handle does |
| `F` | retro, Discussing and Actions, facilitator | highlights the focused topic, or removes the highlight |
| `⌘→` (`Ctrl+→`) | retro, facilitator | next phase, as the main button of the FacilitatorBar, with the same confirmation |
| `C` | poker | plays the coffee card when the deck has one |
| `⇧R` | poker, facilitator, after the reveal | Re-vote |

The handlers live in the session containers built in phase 5; the registry, the preference and the dialog are phase 6. Criterion 32.

**B36 — request id.** A new middleware `App\Http\Middleware\AssignRequestId`, first in the global stack, gives every HTTP request an id (a UUID; an inbound `X-Request-Id` header is not trusted), adds it to the log context (`Context::add('request_id', …)`, so every log line of the request, the reported exception included, carries it) and returns it in the `X-Request-Id` response header. The 500 page receives it as the prop `requestId` and shows it with a copy button. JSON error bodies are unchanged. No storage, no route. Authorisation: none; the id is random and carries no information. Criterion 33.

### 9.3 B37 to B45 — data the mockups show and the server already holds

Added by rule 13 of §5: these elements were omitted by the first plan because no prop carried them. None adds a concept; each exposes or accepts data that an existing model already stores. Authorisation is that of the page or endpoint named, unless stated.

**B37 — session creation options.** `teams.retros.store` accepts `guest_access_enabled` (boolean) and `columns` (a list of `title`, `description`, `color`, within the server's existing column limits) which, when present, replaces the columns of the chosen template: the dialog's column list is editable (add, rename, reorder, recolour). `teams.pokerGames.store` accepts `guest_access_enabled`, `spectator` (boolean: the creator joins as "Watch only") and `tasks` (a list of at most 50 titles, each under the existing task-title rule, created in order). `teams.whiteboards.store` accepts `guest_access_enabled`. "Save as team template" posts the edited columns to the existing `workspaces.templates.store` before creating the retro and is shown only to who may `manageTemplates`. The invitation link itself is shown after creation, in the Share dialog: it does not exist before. Criterion 36.

**B38 — retro: who has written, who has voted.** The board snapshot gains `writersCount` (participants with at least one card), and the `CardCreated` and `CardDeleted` events carry the new count, so the Writing banner reads "n cards · x/y have written" on an anonymous retro too (a count, never names). The snapshot's `roti` object gains `voterIds` (ids of the participants who have voted, never their scores) and `RotiChanged` carries it, for the "Who has voted" list of the ROTI screen. On an anonymous retro `voterIds` is sent as well: it tells who took part, not what they answered. Criterion 37.

**B39 — poker statistics.** `PokerResult` (which computes `average` and `consensus` today) also returns, for a revealed round, `median`, `spread` (`min`, `max` of the numeric votes), `agreement` (share of voters on the most frequent value, 0 to 1) and `outliers` (ids of the players on the lowest and on the highest value when they differ from the most frequent one). They are `null` or empty before the reveal and on an anonymous round `outliers` is empty. Ruling 10 holds: the front end displays what it receives. Criterion 38.

**B40 — estimation history rows.** Each row of `poker/estimates` gains `deck` (the game's deck name or built-in label) and `voters` (`name`, `avatarUrl` of the players of its last revealed round). For an anonymous round the names are withheld and only `votersCount` is sent. Criterion 39.

**B41 — team page session summaries.** Each entry of `retros` on `teams/show` gains `templateName`, `facilitator` (`name`, `avatarUrl`, or `null`) and `rotiAverage` (completed retros with ROTI votes, otherwise `null`). The page gains the deferred prop `pokerPresence`: for each active game, its id and `playersOnline`, read from the presence roster (`PokerPresenceRoster::playerIds()`), `null` when the roster cannot be read. It is deferred because the roster is one call to the realtime server per game. Participant, card and action counts of a retro stay backlog (owner, amendment A7). Criterion 40.

**B42 — workspace page and switcher.** `workspaces/show` gains `membersCount` and `adminsCount`, and each of its `teams` gains `membersCount` and `members` (the first five: `name`, `avatarUrl`). Each entry of the shared prop `workspaces` gains `teamsCount` (teams visible to the user) and `role`. Team description and activity lines stay backlog (owner, amendment A7). Criterion 41.

**B43 — security page.** `settings/security` gains `twoFactor`: `confirmedAt`, `recoveryCodesRemaining` and `recoveryCodesTotal` (numbers, never the codes). A used recovery code is removed, not replaced by a new one, so the count is real. At three codes or fewer the card shows a warning with the count, in the error tone at zero; "Regenerate codes" (the existing Fortify action) sits on the Recovery codes row. Criterion 42.

**B44 — invitation page.** `invitations/show` gains, for a valid invitation, `inviter` (`name`, `avatarUrl`, or `null` when the inviter's account is gone), `role` (the invited role's value; the page translates it), `expiresAt`, `membersCount` and `members` (the first five of the workspace: `name`, `avatarUrl`). They are sent to whoever holds the invitation token, signed in or not, and to nobody else. An expired or already used invitation sends only `isExpired`, `workspaceName` and the name of the `inviter` — no expiry date, no avatar URL (owner's fourth round, narrowed at the 18f security gate, finding P-4); an unknown or revoked token sends `isInvalid` alone. Team, message and "decline" stay out: an invitation is to a workspace, carries no message, and declining is backlog. Criterion 43.

**B45 — guest-join pages.** `retros/join`, `poker/join`, `games/join` and `whiteboards/join` gain `session`: `title`, `facilitatorName` (or `null`), `participantsCount` (people who have joined) and `isLive` (the retro is not completed, the poker game is not ended, the room or the board exists and is open). Sent only for a valid guest token with guest access on. The colour picker and the short code of the mockup stay backlog. Criterion 44.

## 10. Backlog (out of scope, not rendered)

Device sessions with geolocation; linked accounts; password breach check and "last changed"; user-chosen presence colour; profile photo upload; reduced-motion account setting; resumable four-step onboarding; team colour, slug, description, owner and observer roles; team invite link with expiry; default facilitators and rotation; access request from the 403 page; Sessions index with scheduling and drafts; team activity feed; current sprint and sprint entity; per-phase timers; duplicate detection and auto-grouping; undo last group; collaborative discussion notes; "finished voting" flag; ROTI nudge; action status `doing`; bulk action update and bulk Jira sync; actions sourced from whiteboards and surveys; Jira JQL import and story description in poker; similar stories; whiteboard comments, follow a user, convert stickies to actions, thumbnails; poker templates at workspace level; survey builder extras (anonymity modes, close date, threshold, compare to previous sprint, send to whiteboard, CSV; plan 19 built compare and CSV, the rest stays in its backlog, `docs/superpowers/specs/2026-10-19-standalone-surveys-design.md` §13); pinning a GIF to a retro; join by short code; admin sections General, SSO configuration, SMTP, Integrations, MCP keys, Licence, Users, Audit log, backups, maintenance message, version check; a landing page.

Added on 2026-10-02 (shown by a mockup, sent to the backlog by the owner or without back end):

- Retro: export of a finished retro as PDF, CSV or Markdown; ROTI trend against earlier retros on the session-end screen; typing and "is moving a card" indicators; timer pause.
- Poker: CSV export of the estimation history and its deck, period and "re-voted only" filters; spectator flag in presence.
- Team page: retro participant, card and action counts; member role; aggregated action list.
- Action items: filters by priority, due date and source.
- Games: `DeckSaved` / `DeckDeleted` realtime events; game settings beyond name, access, language and reactions.
- Workspace: team description and activity on team tiles; template description, visibility, defaults, usage; the standalone survey and the Poll session type (plan 19, built: `docs/superpowers/specs/2026-10-19-standalone-surveys-design.md`).
- Access: declining an invitation; the "status" and "help" links of the error mockups.

Removed from this list because the application has them and goal 2 keeps them: account deletion (the profile page deletes the account), manual action creation outside a retro (the action-items page has "New action item").

When a mockup shows one of these, the screen omits it, leaves its place (§5 rule 13) and the phase report records the gap. The owner wants most of this list built after the rewrite: `research/front-rewrite/feature-roadmap.md` turns it into features and proposes their order into plans 19 and after. Not requested, and staying here: "Team name" on register, terms and privacy pages, the version in the footer, the export of a retro as PDF, CSV or Markdown, the poker CSV export and history filters.

## 11. Testing and verification

- **Pest browser suite**: green at the end of every phase. Selectors and English accessible names are preserved (§4).
- **Pest feature tests**: every back-end change of §9, including brand contrast in both themes for `#FFD600`, `#22c55e`, `#777777`, `#0a0a0a`, `#e11d48`, `#2B63B0` (`contrast(primary-foreground, primary) ≥ 4.5`, `contrast(primary, background) ≥ 3`).
- **Vitest**: logic of `skrum/` components: card masking, remaining votes display, timer states, rendering of poker average, median and consensus from server values, validation in TemplateEditor and DeckPicker. Where the server computes the value, tests cover display and states, not the calculation.
- **Visual test (Playwright)**: captures `/dev/design-system` and every screen in light and dark, at 1440 and 390, in FR and EN, stored in `tests/visual/__screenshots__/`. It fails on horizontal overflow (an element leaving its parent without an intended `overflow`). Captures are compared by eye with the `preview.html` files.
- **Per phase**: `npm run build`, `npx tsc --noEmit`, `npm run check`, `php artisan test`, Vitest.
- The whiteboard has four walkthrough files (`Plan17a` to `Plan17d`) and a smoke test; they are part of the contract.
- Owner's answers that change a label or a flow (one "New session" trigger, "Reveal cards", the topics-only discussion, the guest link in the Share dialog, inline token creation, confirmations before a delete or a member removal, the reconnecting banner, the single timer list, eight ink colours) change browser tests; each change is listed by the plan under its screen and made in that screen's commit.
- Dead-code evidence in phase 7 comes from `knip` run once through `npx` (not installed). `@testing-library/user-event` is declared as a dev dependency. The manual accessibility checklist is run by an agent with a real browser; the owner reads the report.

## 12. Phases

Each phase is one plan, one branch from up-to-date `main`, merged locally after its report is accepted. Phase 5 is one commit per screen on its branch.

| Plan | Phase | Content | Deleted |
|---|---|---|---|
| 18a | 1 Foundations | `app.css` replaced by the design-system file; fonts; `components.json`; dark mode kept on the existing class, cookie and inline script; logos in `public/brand/`, favicon, `<SkrumLogo>`; `/dev/design-system`; the five layouts; visual test harness; Vitest setup; B8, B9 | The eight dead starter files, Instrument Sans |
| 18b | 2 Themed shadcn | All primitives of the brief with every state on `/dev/design-system` | Replaced primitives |
| 18c | 3 Business components | `components/skrum/*` per README, on `/dev/design-system`, with Vitest | none |
| 18d | 4 White-label and admin | B4–B7, Admin › Branding per ScreenSettings with live preview, contrast ratios and warnings | none |
| 18e | 5 Screens | §7 in order, with B1–B3, B10, B15, the B16 renames, B17–B32, B36–B45 | Old code of each screen in its commit; the `welcome` page |
| 18f | 6 Cross-cutting | B11–B14, B33–B35, the security review of B12, B13, B31 and B33, bell wired to the existing notification routes, global shortcuts and KeyboardShortcuts (`?`) | none |
| 18g | 7 Clean-up | Remaining starter kit and old front end, orphan dependencies, `knip` clean, the three greps of the brief. An old view component that is still imported after phase 5 is rewritten on the design system here; none remains at the end. The phase-5 report lists them. | Everything left |

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
13. Every item of §9 is covered by feature tests; B12, B13, B31 and B33 pass a security review.
14. (B17) `topTemplates` holds five distinct keys. For a team with no retro it is the fallback list in order. For a team with three retros on `sailboat` and one on a workspace template, `sailboat` is first, the workspace template second, and the fallback completes the list. A deleted workspace template and `custom` never appear.
15. (B18) The dialog offers four types and no Poll. Icebreaker creates a room through `teams.games.store` and is disabled, with its reason, when the team has reached the room limit or the user may not create a room.
16. (B19) `started_at` is set by the first card, health-check answer, timer start or phase change, and is not moved by a later one. A retro completed 50 minutes after its start reports `durationSeconds = 3000`; a retro without `started_at` reports `null` and the screen shows no duration. Participation is "joined / team members".
17. (B20) On each of the four session types, with a timer running, the extension moves the end by 120 seconds, answers the new end and broadcasts the type's timer event to others. It answers 422 without a running timer or beyond the type's maximum, and is refused to who may not start the timer (a participant who is not the facilitator or the host, a completed retro, an ended poker game, an icebreaker room). A poker round whose timer was extended is revealed at the new end and not at the old one; a game round likewise expires at the new end. "+2 min" is shown only to who may start the timer, and only while it runs.
18. (B21) A team member opens `poker/decks`; a user who cannot view the team gets 403. Built-in decks are listed locked, with Duplicate; a saved deck shows Edit and Delete to its creator and to a workspace admin only. Setting a default (built-in or saved) is refused without `update` on the team, clears the other column, and is preselected by the new-game form. Deleting the default saved deck clears the default. Duplicate creates "Copy of :name", refuses beyond the deck limit, and never collides with an existing name. A game created from a saved deck raises its usage count by one; changing the game's deck lowers it; a game created before the change counts for nothing.
19. (B22) `/dashboard` lands on the page of the team remembered in the session, on the first visible team by name when none is remembered or the remembered one is no longer visible, on the workspace page when the user sees no team, and on workspace creation when the user has no workspace.
20. (B23) `moodTrend` lists at most eight completed retros, oldest first, each with its mood and ROTI or `null`; a retro with neither is absent; retros of another team never appear; the prop is deferred and the section shows a skeleton, then the chart, or an empty state for a team without data.
21. (B24) Every member and available member carries an `avatarUrl` served by the application.
22. (B25) `counts` gives the open, overdue and completed totals, the viewer's own open items and the number of retros they come from, under the current team and assignee filters; it ignores the status filter and never counts an item the user cannot see.
23. (B26) The server accepts a stroke and a fill in each of the eight theme colours and in black, and still accepts the five old names. A drawing stored with old colours replays with its old RGB values. The toolbar offers black and the eight colours; an unknown colour is refused with a validation error.
24. (B27) A new room has reactions on. The host turns them off and on in the room settings; the change reaches the other players without a reload; the bar is absent while they are off. The field is refused on an icebreaker room and for a player who does not manage the room. A reaction sent by a player, guest included, flies on the other players' screens.
25. (B28) A room with an active round is `playing`, any other `waiting`; `players` holds at most five entries with an avatar URL, and `playersCount` the total. A room created, renamed, deleted, started or joined in one browser changes the list of another member's browser without a reload. The channel `team-games.{teamId}` is refused to a user who cannot view the team, to a guest and to an unauthenticated socket; an icebreaker room of a retro sends nothing on it; the payload holds no word, drawing or answer of a round.
26. (B29) Every sticky of the eight built-in templates has one of the eight palette fills and the border of that colour; a new board created from a built-in template shows its notes with the matching swatch selected in the colour bar; a board created before the change is untouched.
27. (B30) The Whiteboard tab lists the workspace's whiteboard templates with their preview; the Poker tab lists the workspace's decks. A workspace manager creates, edits and deletes a workspace deck; another member gets 403. A workspace deck appears in the deck lists of every team of the workspace, can be a team's default, and belongs to no other workspace. The Retro tab lists the built-in templates and the workspace's, with search and categories; a built-in template has no Edit or Delete. "Use" on a retro template, a deck or a whiteboard template opens the "New session" dialog of the current team with it selected; it is disabled without a current team.
28. (B31) A logged-out visitor of a valid invitation sees one button per enabled provider, and none on an invalid or expired invitation or when signed in. A new person who signs in through SSO with the invited address gets an account, joins the workspace and lands in it. With another address the invitation is not accepted and the sign-up mode decides. An existing account that signs in through SSO returns to the invitation and accepts it with the button. A second factor is still challenged. (Plan 18f adds: an address the provider does not mark verified is refused, with or without an invitation.)
29. (B32) `GET /` answers a redirect to the login page for a guest and to `/dashboard` for a signed-in user; no `welcome` page exists.
30. (B33) With `sso_required` in force, password login, passkey login, form registration, password-reset requests and magic-link requests are refused by the server for ordinary users, and the login page offers SSO only. An instance admin still signs in with password and second factor, and is refused that way without a confirmed second factor. With no enabled provider the setting is ignored for everyone, the password form is back, and instance admins see the alert; other users do not. The setting cannot be turned on without an enabled provider. Only an instance admin can read or change it.
31. (B34) A user with `recap_emails` off receives no recap and is not counted among the recipients. The signed link turns the preference off for its user only, does nothing on `GET`, refuses a forged or altered signature, and signs nobody in. The switch in Settings › Notifications turns it back on.
32. (B35) Each of the five shortcuts triggers its control, for the role and phase stated, and never while a field is being edited. With `single_key_shortcuts` off, no single-character shortcut fires, `⌘→`, `⌘K`, `Esc` and `↵` still work, and the help dialog says so. The preference is stored for a member and kept locally for a guest.
33. (B36) Every response carries an `X-Request-Id`; two requests get two ids; an inbound header of that name is ignored. A request that fails with a 500 logs its exception with the same id that its error page shows. No id is shown on the other error pages.
34. (B15) An HTML request that meets 403, 404, 419, 429 or 500 gets the design-system error page with that status; a JSON request keeps its JSON body and status. `php artisan down` and `abort(503)` serve the static 503 view, which renders with the database unreachable and loads no script.
35. (§5 rule 13) The report of every screen holds a side-by-side comparison of its captures with the mockup's `preview.html`, in light and dark, at 390 and 1440, and the list of the differences that remain. Each remaining difference is a row of the "Deviations from the mockup" table approved by the owner, or it is fixed. No element is omitted for want of a prop when the server holds its data.
36. (B37) A retro created with `columns` has exactly those columns, in order, and the chosen template's name; invalid colours or too many columns are refused. `guest_access_enabled` at creation opens the guest link at once on the three session types. A poker game created with `spectator` has its creator watching, and with `tasks` has those tasks in order; more than 50 titles are refused.
37. (B38) `writersCount` counts each participant once, follows card creation and deletion live for the other participants, and reveals no author on an anonymous retro. `roti.voterIds` lists who has voted and never a score; a retract removes the id.
38. (B39) For the votes 3, 5, 5, 8 the result gives median 5, spread 3 to 8, agreement 0.5 and the two players on 3 and 8 as outliers; `?` and coffee cards are ignored; nothing is sent before the reveal.
39. (B40) A history row shows its deck and the voters of its last revealed round; an anonymous round shows a count.
40. (B41) A retro card shows its template, its facilitator and, once completed with votes, its ROTI; an active game shows how many players are in the room, or nothing when the roster is unavailable.
41. (B42) The workspace header and each team tile show their member counts and the tile its first five members; the switcher shows the role and the number of teams of each workspace; a team the user cannot see is not counted.
42. (B43) The security page shows when the second factor was added and how many recovery codes are left, and never sends the codes with the page.
43. (B44) A valid invitation shows who invited, the role, the expiry date and the members. An expired or already used invitation shows the workspace name and the name of who invited, so the visitor knows whom to ask, and gets nothing else of the workspace (no role, no members, no e-mail, no token). An invalid (unknown or revoked) token gets none of these props.
44. (B45) A valid guest link shows the session's title, facilitator, number of people and whether it is live; an invalid link, or a session with guest access off, gets none of them.

## 14. Risks

- Phase 2 changes how old pages look until they are rewritten. The browser suite is the guard.
- The browser suite binds to English text. Mockup labels that differ from current labels cause test edits; each is listed in the phase report.
- Excalidraw is themed through internals of 0.18.1. The version stays pinned.
- B1 and B10 touch persisted data and public payloads. B1 reaches the board snapshot, the team page and the MCP board presenter; B10 reaches the board snapshot, the `columns.changed` event and the template props. No webhook or export carries a phase or a column colour. Their plan lists every consumer before changing the enum.
- B12 and B13 add authentication surface to a front-end project. They are isolated in phase 6 and reviewed separately. B31 exposes an existing SSO flow on one more page and tightens it, and B33 can lock people out: both are in that review.
- The inventories are static readings. A feature missed there would be missed in the rewrite; each screen's plan re-reads the old code before deleting it.
- The owner's answers of 2026-10-02 and rule 13 add twenty-nine back-end items to a front-end project (B17–B45). Each is small and follows an existing pattern, but together they widen phase 5; their tasks come before the screen that needs them and each has its own feature tests.
- B19's start time is the first activity, as the owner confirmed. A team that writes cards the day before the meeting gets a duration of a day.

## 15. Open points

The owner answered the seventeen points of the first version of this section on 2026-10-02 (third round); the answers are in the text above (rule 13, B18 to B21, B23, B26, B28, B30, B31, B33, B35, ruling 19). What follows is only what the third round's new designs left to choose. Each is built as written unless the owner says otherwise.

1. **Workspace decks (B30).** A deck is owned by a team or by a workspace, in the same table; workspace managers manage workspace decks, every member uses them, and the limit is the team's limit (30) counted per workspace. An existing team deck is not moved to the workspace by the migration, and there is no "promote to workspace" action: a manager creates a workspace deck with the same cards.
2. **Team games channel (B28).** A private channel per team, for signed-in users who can view the team; a "player joined" event is sent for every new player of a standalone room. Live presence (who is in a room right now) is not sent: the list shows who has joined.
3. **"+2 min" maxima (B20).** Each extension is capped by the maximum its timer already accepts (two hours for a retro and a game room, one hour for a poker round and a whiteboard), rather than one cap for all.
4. **`sso_required` and admins (B33).** The administrator's password form is reached by a link on the login page, visible to everyone; it accepts only instance admins who have a confirmed second factor. An admin without one cannot use it.
