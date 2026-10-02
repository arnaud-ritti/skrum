# Old components left after plan 18e (list for plan 18g)

Written by Task F1, 2026-10-02, on `plan-18e-screens`. Base of the comparison: `310a5026` (head of `plan-18d-branding`, the commit before the first commit of plan 18e).

Method: `git diff --name-status 310a5026 HEAD -- resources/js/components resources/js/layouts`, outside `components/ui/`, `components/skrum/` and `components/session/`, test files left out. A file with no line in that diff was not touched by plan 18e. Importers come from a `grep` of `@/<path>` and of `./<name>` over `resources/js`; the file's own test does not count, and neither do the browser walkthroughs (owner decision).

Before plan 18e the two folders held 287 such files. Plan 18e deleted or replaced 153 of them, changed 91 in place, moved 14 (some out of these folders, to `components/session/`), and left 29 untouched: the 29 files of this page. Twelve are old view components still imported: the rows of the first table.

## Old view components still imported (to rewrite on the design system in 18g)

| File | Imported by | What it renders |
|---|---|---|
| `components/heading.tsx` | `components/settings/avatar-style-card.tsx` | The starter's page heading: a title and a description, in two sizes. In the F1 list; kept because of its importer |
| `components/input-error.tsx` | `components/retro/surveys/survey-draft-field.tsx` | The starter's field error line (red text under a field). In the F1 list; kept because of its importer |
| `components/settings/avatar-style-card.tsx` | `pages/settings/profile.tsx` | The avatar style card of the profile page: `Heading`, the `AvatarStylePicker` of the design system, Save and Reset. The card frame around the picker is the old one |
| `components/breadcrumbs.tsx` | `components/skrum/app-topbar.tsx`, `pages/dev/sections/breadcrumb.tsx` | The breadcrumb trail of the top bar (links, separators, collapse of the middle items) |
| `components/language-switcher.tsx` | `layouts/skrum/auth-layout.tsx`, `layouts/skrum/onboarding-layout.tsx`, `components/retro/board.tsx`, `components/retro/board-topbar.tsx`, `components/poker/poker-room.tsx`, `components/games/room-header.tsx` | The language select (a native `select` posting the locale) |
| `components/nav-user.tsx` | `layouts/skrum/app-layout.tsx`, `layouts/skrum/session-layout.tsx` | The account button at the foot of the sidebar and its menu trigger |
| `components/user-info.tsx` | `components/nav-user.tsx`, `components/user-menu-content.tsx` | Avatar, name and e-mail of the signed-in user |
| `components/user-menu-content.tsx` | `components/nav-user.tsx` | The entries of the account menu (settings, about, log out) |
| `components/notification-bell.tsx` | `layouts/skrum/app-layout.tsx` | The bell, its unread count and the dropdown of notifications. Plan 18f owns the notifications panel: check what its lane did before rewriting |
| `components/integrations/share/delivery-lines.tsx` | `components/retro/board-share.tsx`, `components/retro/session-end.tsx`, `components/poker/room-dialogs.tsx`, `components/games/room-share-dialog.tsx` | The list of deliveries of a share (channel, state, error, time) under the share dialogs |
| `components/retro/card-insight.tsx` | `components/retro/suggestions-list.tsx` | The sentiment icon and the AI tags of a card in the suggestions list |
| `components/retro/results/health-radar.tsx` | `components/retro/results/health.tsx`, `components/retro/results/health-trend.tsx` | The radar chart of the health check and `formatScore` |

## Kept, not a view (logic only)

| File | Imported by |
|---|---|
| `components/retro/board-context.tsx` | the retro board (33 files) |
| `components/poker/auto-reveal-triggers.tsx` | `components/poker/poker-room.tsx` |
| `components/admin/admins/types.ts` | the admins page and its parts |
| `components/admin/branding/branding-api.ts`, `samples.ts`, `use-palette-preview.ts` | the branding page and its parts |

## Untouched, but already on the design system (plans 18c and 18d): nothing to rewrite

`components/about/about-content.tsx`; `components/admin/admins/{admins-list,admins-panel,candidate-combobox,revoke-admin-dialog}.tsx`; `components/admin/branding/{contrast-badge,default-hint,gif-settings}.tsx`; `components/dev/bench.tsx`; `layouts/skrum/settings-layout.tsx`; `layouts/skrum/onboarding-layout.tsx` (no importer but its own layout test: unused until the onboarding, plan 25; the plan leaves it to 18g).

## Deleted in F1 (27 files)

No importer, no unit or feature test, no route and no page referenced them.

- The layout switch: `layouts/app-layout.tsx`, `layouts/app/app-sidebar-layout.tsx`, `layouts/auth-layout.tsx`, `layouts/auth/auth-simple-layout.tsx`, `layouts/settings/layout.tsx`, `lib/page-layouts.ts`, `lib/page-layouts.test.ts`. `app.tsx` now has `layout: () => null`: every page renders its own layout.
- The old sidebar and its starter helpers: `components/app-sidebar.tsx`, `app-shell.tsx`, `app-content.tsx`, `app-sidebar-header.tsx`, `nav-main.tsx`, `workspace-switcher.tsx`, `app-logo.tsx`, `app-logo-icon.tsx`.
- Of the plan's F1 list: `components/retro/{connection-banner,session-expired-banner,presence-strip,timer-display,live-cursor-layer,ai-summary-switch,icebreaker-game-select}.tsx`, `components/realtime/flying-reactions.tsx`, `components/templates/template-chips.tsx`, `components/confirm-form-dialog.tsx`, `components/password-input.tsx`.
- Found dead by the same check, outside the plan's list: `components/integrations/share/post-link-section.tsx`.

## Not looked at here (18g, with its dead-code script)

- Hooks, `lib/` files and `types/` that only the deleted files used.
- Translation keys that only the deleted files used.
- Unused dependencies, `knip`, the starter files that were never part of a screen.
- The rename of `LocksDiscussingRetro`.
- A page added by a later branch must render its own layout: `app.tsx` no longer wraps anything.
