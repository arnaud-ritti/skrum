# Brief 09 — WORKSPACE PAGES (plan 18e, screen group 9)

Read-only research. Verified by reading the code at HEAD f8ea376d (branch plan-18d-branding, uncommitted files ignored). Not verified: no test or build was run; the exact aria-label of the template-editor drag handle (template-editor.tsx ~l.539) and the Sheet markup were not read; how a page hands `active` / `breadcrumbs` to the new `layouts/skrum/app-layout.tsx` (see Risks R1).

## 1. Scope

| Page | Route (name) | Props (unchanged) | Layout | Mockup |
|---|---|---|---|---|
| `pages/workspaces/show.tsx` | `GET w/{workspace}` (`workspaces.show`) | `workspace{id,name,slug}`, `teams[{id,name}]`, `canManage` | AppLayout (skrum), active `teams` | ScreenWorkspace frames a/b (`docs/design-system/components/ScreenWorkspace/`) |
| `pages/workspaces/create.tsx` | `GET workspaces/create` (`workspaces.create`) | none | AppLayout (user may have no workspace: `currentWorkspace` null, sidebar must cope) | none: from ScreenWorkspace header + ScreenOnboarding/ScreenAuth card |
| `pages/workspaces/members.tsx` | `GET w/{workspace}/members` (403 for plain members) | `workspace`, `members[{id,name,email,role}]`, `invitations[{id,email,role,isExpired}]`, `isOwner`, (`canManage` always true, ignore) ; flash `invitationUrl` | AppLayout, active `teams` (no sidebar key of its own) | none: from ScreenWorkspace + ScreenTeam members card (`tm-member`) + `ui/table` README |
| `pages/workspaces/templates.tsx` | `GET w/{workspace}/templates` | `workspace`, `templates[{id,name,category,columns[{title,description,color}]}]`, `categories[{value,label}]`, `canManage`, `catalogue?` (`Inertia::optional`) | AppLayout, active `templates` | ScreenWorkspace frames c/d (templates), `TemplateEditor/README.md`, `RetroTemplatePicker/README.md` |

Out of the pages: the sidebar workspace switcher (`components/workspace-switcher.tsx`) is already replaced by `skrum/app-sidebar.tsx` (`workspaces`, `newWorkspaceHref`, `useSidebarModel`); only its deletion belongs here. Whiteboard templates are NOT on these pages (managed on `teams/show` via `components/teams/whiteboard-templates-dialog.tsx`, group 4). `/dashboard` is a pure redirect (no UI).

## 2. Commits (order)

| # | Commit | Deletes |
|---|---|---|
| 9a | `feat(workspaces): workspace page and workspace creation` — show, create, shared `LeaveWorkspaceDialog`, link to members and templates | old bodies of `pages/workspaces/show.tsx`, `create.tsx` (rewritten in place). `components/workspace-switcher.tsx` only if `components/app-sidebar.tsx` and `layouts/app/app-sidebar-layout.tsx` are already gone (else 18g; see R2) |
| 9b | `feat(workspaces): members, roles and invitations` | old body of `pages/workspaces/members.tsx` |
| 9c | `feat(workspaces): retro templates page with the template editor` | old body of `pages/workspaces/templates.tsx`; `components/templates/template-chips.tsx` and `components/confirm-form-dialog.tsx` ONLY when no other screen imports them (today also `teams/new-retro-dialog.tsx`, `teams/show.tsx`, `settings/revoke-token-dialog.tsx`; see R2) |

## 3. Parity table

Hooks: no browser test touches show, create or members (grep of `tests/Browser` for their texts: none). Feature tests (`tests/Feature/Workspaces/*`) bind to Inertia props and routes only: keep props. Names below are the OLD English accessible names: keep them.

| # | Action / behaviour (old) | Old control (file) | Route / event | New component and control | Hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Page title and subtitle "Teams in this workspace" | show.tsx `Heading` | – | header `ws-head`: mark (initial), `h1` workspace name, subline "N teams · you're an admin/owner/member" | `<Head title={workspace.name}>` | Member count in the mockup subline is not in props: omit (gap G1); role from shared `currentWorkspace.role` |
| 2 | Create team (manager) | show.tsx inline `Form` input `name` (required, max 100, ph + aria "New team name"), btn "Create team", `errors.name` | `POST w/{workspace}/teams` `teams.store`, `resetOnSuccess` | Header primary Button "New team" and the dotted `ws-newteam` tile open `FormDialog` (skrum/confirm-dialog) with `TextField name="name"` | input `name`, aria "New team name", submit named "Create team" | Mockup replaces the inline form by a button: new strings ("New team"); submit label stays "Create team". `FormDialog.error` takes one string: pass `errors.name` |
| 3 | Open a team | show.tsx `Link`+`Card` | `GET teams.show` | `Card` link per team (`ws-team`): mark in `columnColorClass`, name, "Open" | `a[href$="/teams/{id}"]` | Description, 3 activity lines, member stack of the mockup have no data (`teams` = `{id,name}`): omit (G2). Colour: derive deterministically from team id (no data) |
| 4 | Empty states | show.tsx `<p>` | – | `EmptyState` (module `retro`? none fits: use `module="actions"` illustration=false) or plain muted block; text kept | "No teams yet. Create the first one." / "You are not a member of any team yet." | Manager text keeps a "New team" action |
| 5 | Leave workspace, no confirmation | show.tsx ghost `Form` button, `errors.member` | `DELETE w/{workspace}/members/{auth.user.id}` `workspaces.members.destroy` | Discrete `ws-leave` section (separator, muted text, ghost destructive button "Leave workspace") opens `LeaveWorkspaceDialog` = `FormDialog tone="destructive"` + consequence list + type-the-name `Input` | button "Leave workspace"; 422 `member` ("A workspace needs at least one owner.") shown via `FormDialog.error` | Mockup imposes confirmation with typed name (ScreenWorkspace frame a `ws-confirm`, mobile = Dialog). "You're one of N admins" line has no data: omit. Submit disabled/rejected until typed name equals `workspace.name` (use the "The name does not match." key already in lang) |
| 6 | "Leave" also reachable on members row | members.tsx | same route | same `LeaveWorkspaceDialog` (type-name kept for consistency) | button named "Leave" on own row | |
| 7 | Link to members (manager only; no sidebar entry) | none (only sidebar "Members" if role≠member in OLD sidebar) | `GET workspaces.members.index` | Header Button outline "Invite people" (icon `UserPlus`) on show, only `canManage` | link text "Invite people"; `a[href$="/members"]` | Required by notes-for-18e. `canManage` = owner/admin = exactly who passes `manageMembers` (assumption, check `User::canManage` vs `manageMembers` policy: not verified) |
| 8 | Link to templates | sidebar | `workspaces.templates.index` | "Manage templates" link-button in Teams section header + sidebar "Templates" | `a[href$="/templates"]` (Plan08a-07a) | Sidebar already has it |
| 9 | Create workspace | create.tsx `Form`, label "Workspace name", input `name` required autoFocus max 100, `errors.name`, btn "Create workspace" | `POST workspaces` `workspaces.store` | Centered `Card` (max-w-md) with title "Create a workspace", description, `TextField label="Workspace name" name="name" id="name"` + `LoadingButton` "Create workspace" | `#name`, label "Workspace name", button "Create workspace" | Keep Inertia `<Form>`; `errors.name` into `TextField.error` |
| 10 | Switch workspace / "New workspace" / "Select a workspace" | workspace-switcher.tsx | `workspaces.show`, `workspaces.create` | sidebar team switcher (already in `skrum/app-sidebar.tsx`) | aria "Switch team or workspace" per mockup | Not written here; verify only that `workspaces.create` is reachable with `currentWorkspace === null` (R4) |
| 11 | Members list: name, email | members.tsx `ul` | – | `ui/table` (`Table`,`TableHeader`,`TableRow`,`TableCell`): Member (Avatar initials + name + email) / Role / actions. Below 40rem rows stack (Table README) | – | No `avatarUrl` in `members` props: initials only (G3) |
| 12 | Change role (select) | members.tsx `Select` aria "Role" per row; `owner,admin,member` for owner, `admin,member` for admin; fires on change | `PATCH w/{workspace}/members/{member}` `workspaces.members.update`, `router.patch {role}`, `preserveScroll`, `onError` row error | `Select` aria-label "Role" (`ui/select`), same logic; row error under select (`text-skrum-destructive-text`) | aria "Role"; 422 `role` text; | Owner row seen by non-owner: static `Badge` "Owner", no select, no Remove. 403 not handled today (keep; note in R6) |
| 13 | Remove member / leave | `ConfirmFormDialog` trigger "Remove"/"Leave", title "Remove :name from this workspace?" / "Leave this workspace?", description, `errorKey="member"` | `DELETE w/{workspace}/members/{member}` `preserveScroll` | `ConfirmDialog tone="destructive"` (`onConfirm` = promise wrapping `router.delete`, reject on `onError` and set `error` from `errors.member`); own row uses row 6 | button "Remove"/"Leave"; dialog title/description texts; confirm label "Remove"/"Leave" | `ConfirmDialog` is promise based: write one adapter `useRouterConfirm` in `components/workspaces/` (resolve onSuccess, reject onError). Dialog role is `alertdialog` (was `dialog`) |
| 14 | Invite | members.tsx `Form resetOnSuccess=['email']`, `Input type=email name=email` ph+aria "Email address", `Select name=role` (Member/Admin; no owner) aria "Role", btn "Send invitation", `errors.email` | `POST w/{workspace}/invitations` `workspaces.invitations.store` (throttle 20/min) | Section "Invite people": `TextField type=email name=email label="Email address"` + `Select name=role` + `LoadingButton` "Send invitation" | aria "Email address", aria "Role", button "Send invitation"; `errors.email` ("This person is already a member of the workspace.") | Radix `Select name=` posts a hidden input: keep as today |
| 15 | Invitation link (mail driver `log`) | members.tsx read-only `Input` in a box, select on focus | flash `invitationUrl` (`page.flash.invitationUrl`) | `Alert` (ui/alert) + read-only `Input` + Button "Copy link" (`useClipboard`) | text "Email is not configured on this instance. Share this link with the invited person:" | Copy button is new (gain). The link exists only in the redirect right after Send / Resend: tokens are hashed, a later list cannot show it |
| 16 | Pending invitations list | members.tsx `ul`: email, role Badge, destructive "Expired" Badge | – | second `Table`: Email / Role / Status / actions; empty = `TableEmpty` ("No pending invitations": new key; old rendered an empty box) | badges "Admin"/"Member"/"Expired" | |
| 17 | Revoke invitation (no confirm) | ghost `Form` button "Revoke" | `DELETE w/{workspace}/invitations/{invitation}` `workspaces.invitations.destroy`, `preserveScroll` | Ghost destructive Button "Revoke" with icon (`Trash2`/`X`), no dialog, per row | button "Revoke" | Mockup rule 6: destructive keeps icon + label. Keep no confirmation (parity) |
| 18 | Resend invitation | none in old front | `POST invitations.store` with the row's email and role (server replaces the pending one, new 7-day token, resends mail / new flash link) | Ghost Button "Resend" per row (icon `Send`), uses `router.post` | button "Resend" (new) | Needs no back-end change. Asked in the task; Feature test of replace-on-reinvite exists (`WorkspaceInvitationsTest`: not read) |
| 19 | Delete workspace (isOwner) | members.tsx section + `ConfirmFormDialog` "Delete this workspace?" / destructive "Delete workspace" | `DELETE w/{workspace}` `workspaces.destroy` → redirect `dashboard` | "Danger zone" section, `FormDialog tone="destructive"` with typed workspace name (pattern of dev section "Delete the workspace" in `pages/dev/sections/dialog.tsx`) | trigger and submit named "Delete workspace"; title "Delete this workspace?"; description "This permanently deletes the workspace, its teams and their retrospectives." | Typed name is new (designed from the Leave mockup). Visible only `isOwner` |
| 20 | Heading "Members" + workspace name | `Heading` | – | page `h1` "Members", subline workspace name, breadcrumb Workspace > Members | `<Head title="Members">` | |
| 21 | Templates list (all roles read-only) | templates.tsx `ul`: name, category Badge, chips | – | card grid `tp-grid` (`repeat(auto-fill,minmax(min(100%,16.5rem),1fr))`): `tp-prev` column strip (composed), name, category `Badge`, "N columns" | name, category label (from `categories`), column titles as text | Composed from primitives (no template card in `skrum/`): reuse `columnColorClass` from `skrum/retro-template-picker.tsx` |
| 22 | Subtitle | `Heading` | – | "Templates shared by every team of this workspace" | text | Mockup tabs All/Retro/Poker/Whiteboard: see §6 |
| 23 | Empty state | `<p>` "No workspace templates yet." | – | `EmptyState` module `retro`, title same text, action "New template" for managers | text "No workspace templates yet." | Plan08a-07b asserts the text |
| 24 | New template (manager) | Button "New template" (Plus) | on open, if `catalogue` undefined: `router.reload({only:['catalogue']})` | Button "New template" → `Sheet` (large; full screen on mobile) containing `TemplateEditor mode="create"`; keep the reload effect | button text "New template"; `[role="dialog"]` (Sheet is a Radix dialog) | Editor loading of catalogue: no skeleton today; `startFrom` simply appears when loaded |
| 25 | Start from a built-in | `Select` "Start from a built-in template" (`!isWorkspace` with columns) | client | `TemplateEditor.startFrom=[{key,name}]` + `onStartFrom` (fills name only if empty, category, columns) | `#template-source`, option text e.g. "Start, Stop, Continue" | Default ids kept (`ids` prop) |
| 26 | Edit name (max 80) / category / description-less | Input `#template-name`, Select `#template-category` | client | `TemplateEditor` name + category (`categories` prop) | `#template-name`, `#template-category` (shows "Team & mood") | Editor also offers description, visibility, default settings: NOT passed (draft omits `description`, `visibility`, `defaults`: no back end) |
| 27 | Column title/colour/description | Input aria "Column title", Select aria "Color", Textarea aria "Description" | client | editor column row: title input, `ColumnColorPicker`, help question input | **changes**: aria "Column :position title"; colour picker button; help question | Mockup-imposed (`TemplateEditor/README.md`): update Plan08a-07b |
| 28 | Reorder columns | "Move up"/"Move down" buttons | client | dnd-kit handle (keyboard: Space, arrows) | **changes**: no Move up/down | Mockup-imposed: README "poignée"; test must reorder with keyboard or drop that step |
| 29 | Remove column (disabled when 1) | Trash aria "Remove column" | client | trash button aria "Delete column “:title”", Del key, 5 s undo toast | **changes** | `[role="dialog"] fieldset > div:nth-of-type(3) [aria-label="Remove column"]` no longer matches |
| 30 | Add column (max 10; colour cycles) | "Add column" | client | "Add a column"; first free colour | **changes**: label "Add a column"; `MaxTemplateColumns = 10` already | |
| 31 | Save (create) | submit "Save" | `POST w/{workspace}/templates` `workspaces.templates.store` body `{name,category,columns[{title,description,color}]}` `preserveScroll`, close on success, toast "Template saved." | `TemplateEditor.onSave` → `router.post`/`useForm.submit`; `saving={form.processing}`; `errors={form.errors}` | `[role="dialog"] button[type="submit"]` named "Save" | Duplicate name 422 and 100-template cap land on `errors.name` |
| 32 | Open Edit / Save (update) | "Edit" per row; editor keyed by id | `PATCH …/templates/{template}` `workspaces.templates.update`; columns replaced; toast | `TemplateEditor mode="edit"`, key = template id; card click or "Edit" button (managers) | button "Edit" per card for managers | |
| 33 | Delete template | `ConfirmFormDialog` per row "Delete this template?" / "Retrospectives created from it keep their columns." | `DELETE …/templates/{template}`; toast "Template deleted." | Editor footer "Delete template" (ghost destructive, icon + label) → built-in `ConfirmDialog`; `onDelete={() => router.delete(…)}` promise adapter | **changes**: delete is inside the editor, label "Delete template" (was row "Delete") | Description text in the component is "Retros already created from it are not affected." vs test text: see R3 |
| 34 | Cancel | Cancel / dialog dismiss | client | editor "Cancel" + Sheet close | button "Cancel" | |
| 35 | Validation errors (name, category, columns.N.title/description/color, columns) | `InputError` | 422 | editor error plumbing (`errors` record) + "N fields to fix" summary | – | `errors.category` and `errors.columns` have no dedicated slot: verify at implementation (R5) |
| 36 | Member read-only view | no buttons | – | cards without buttons for non-managers | `assertNotPresent("{$row} button")`, no "New template" | |
| 37 | Duplicate (asked; not in old front) | none | `POST …/templates` (store) | editor `onDuplicate` (edit mode) and card menu: reopen editor in create mode with draft copy, name "Copy of :name"; same on a built-in via `catalogue` | button "Duplicate" | Client-side only; no route. `RetroTemplatePicker` README names "Dupliquer et modifier" |
| 38 | Flash toasts | global `useFlashToast` | `toast` flash | unchanged (Toaster) | "Template saved." "Template deleted." | |

(38 rows; rows 5/6, 12/13 are grouped by control, not skipped.)

## 4. Composition

New folder `resources/js/components/workspaces/` (spec §6.1 names it). Pages stay thin.

| Container (file) | Used by | Content |
|---|---|---|
| `workspace-overview.tsx` | show | header (`ws-head`), Teams section (`Badge` count, "Manage templates" link), team grid, dotted new-team tile, leave section |
| `team-tile.tsx` | overview | `Card` as `Link`; mark with `columnColorClass(...)`; adapter `{id,name}` -> `{href: TeamsController.show({workspace: slug, team: id}), initial: name.slice(0,1)}` |
| `new-team-dialog.tsx` | overview | `FormDialog` + `TextField`; posts `TeamsController.store` via `router.post(url,{name},{onError})`, resolves on success |
| `leave-workspace-dialog.tsx` | show, members | `FormDialog tone="destructive"`; children: consequence list + `TextField` (type name); `onSubmit` rejects when name differs; posts `WorkspaceMembersController.destroy` with `auth.user.id` |
| `create-workspace-form.tsx` | create | Card + Inertia `<Form {...WorkspacesController.store.form()}>` |
| `members-table.tsx` | members | `Table`; role `Select`; Remove/Leave; rows from `members` (`id,name,email,role`), `auth.user.id` for `isSelf`, `isOwner` for assignable roles |
| `invite-form.tsx` | members | Inertia `<Form {...WorkspaceInvitationsController.store.form(slug)} resetOnSuccess={['email']} options={{preserveScroll:true}}>` |
| `invitations-table.tsx` | members | rows `{id,email,role,isExpired}`; Resend/Revoke; `InvitationLink` alert from `page.flash.invitationUrl` |
| `delete-workspace-section.tsx` | members | `isOwner` only |
| `templates-gallery.tsx` | templates | card grid, preview strip `tp-prev` (composed: flex of `tp-col` with `columnColorClass` classes), empty state |
| `template-editor-sheet.tsx` | templates | `Sheet` + `TemplateEditor`; `useForm<{name,category,columns}>`; adapters below |
| `use-router-action.ts` | all dialogs | `(run) => Promise<void>` resolving on `onSuccess`, rejecting on `onError` and exposing `error` |

Primitives used: `ui/card`, `badge`, `button`, `select`, `input`, `table`, `sheet`, `dialog`, `alert`, `separator`, `tooltip`; `skrum/confirm-dialog` (`ConfirmDialog`, `FormDialog`), `skrum/template-editor` (`TemplateEditor`, `firstFreeColor`), `skrum/column-color-picker` (inside editor), `skrum/text-field`, `skrum/loading-button`, `skrum/empty-state`, `skrum/avatar-stack`/`ui/avatar` (initials). `skrum/retro-template-picker.tsx`: NOT mounted (see §6 and D2); only `columnColorClass` is imported.

Adapters (server -> component):
- `WorkspaceTemplateSummary` -> `TemplateDraft`: `{name, category, columns: columns.map((c,i)=>({id: `${template.id}-${i}`, title: c.title, description: c.description, color: c.color}))}`; no `description`, `visibility`, `defaults` keys (the editor hides those fields when absent).
- `TemplateDraft` -> payload: `{name, category, columns: columns.map(({title, description, color}) => ({title, description: description ?? '', color}))}` (old code sent `''` for empty description: keep).
- `categories` -> `TemplateEditor.categories` (same `{value,label}`); `catalogue.filter(!isWorkspace && columns.length>0)` -> `startFrom=[{key,name}]`; `onStartFrom(key)` fills as `startFrom()` of old page.
- `colors`: pass `serverColumnColors` (default) until B10 lands (D3).
- `errors`: `form.errors as Record<string,string|undefined>` straight to `errors`.
- Members: `WorkspaceMember` -> row; assignable roles `isOwner ? ['owner','admin','member'] : ['admin','member']`; labels `t('Owner')` etc. through a literal map (keep `t('Owner')`, `t('Admin')`, `t('Member')` literal calls for `TranslationKeysTest`).
Reuse as is: `@/actions/App/Http/Controllers/{Teams,WorkspaceMembers,WorkspaceInvitations,Workspaces,WorkspaceTemplates}Controller`, `useTrans`, `useClipboard`, `useFlashToast`, `types/workspaces.ts` (types stay).

## 5. Realtime

None on these four pages (inventory 5. = none). Nothing to keep with two browsers. Only indirect: the sidebar `workspaces`/`teams` shared props refresh on Inertia visits.

## 6. Mockup elements not rendered / designed without mockup

Not rendered (spec §10 backlog or no back end):
- Team card description, activity lines (live retro, active games, open/overdue actions), member stack and total (props `teams` = `{id,name}`; team description/colour is backlog "team colour, description").
- Workspace header member count; "you're one of N admins, X stays admin" line.
- Workspace switcher shortcuts ⌘2/⌘3 and per-workspace team count/role (sidebar owner, group on layout).
- Templates: tabs All/Retro/Poker/Whiteboard and the poker section (backlog: "poker templates at workspace level"); the whiteboard "empty state" (whiteboard templates live on the team page; no prop here); template card usage count, author, "Use" button (no workspace-level use flow; D1); `TemplateEditor` description, visibility segmented control, default settings, "edited by … " meta, usedByTeams, concurrent-edit `version` alert (no back end).
Designed from neighbours: `create` (Card on the onboarding/auth card pattern + ScreenWorkspace header); `members` (ScreenWorkspace header and sections, `tm-member` row pattern of ScreenTeam, `ui/table`, destructive pattern of `ws-confirm`); invitation link alert; Resend; delete-workspace section.

## 7. Back-end changes

None from spec §9 are needed by this group. Gaps (report, not plan): G1 workspace member count and per-team data (description, colour, counts, members) absent; G2 same; G3 `members[]` has no `avatarUrl`; G4 templates have no description/visibility/defaults/usage/author; G5 no resend or "get link" route (resend uses the store route); G6 B10 (ColumnColor enum rename, owned by the retro group) changes `TemplateColumn.color`, validation in `WorkspaceTemplateRequest`, `lib/retro/types.ts`.

## 8. Browser tests

Existing coverage: only `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php`.

| Test | Binds to | Verdict |
|---|---|---|
| `[P08a-07a]` member read-only | `a[href$="/templates"]` (team page link, group 4), text "Templates shared by every team of this workspace", `li:has-text("Team pulse")`, texts "Team & mood" "Energy" "Blockers", `assertNotPresent("{$row} button")`, no `button:has-text("New template")` | MUST change: `li:has-text` -> card selector (mockup frame c uses `tp-card`, no list); give each card `data-test="workspace-template-{id}"` and use it |
| `[P08a-07b]` Owner creates | "No workspace templates yet.", `button:has-text("New template")`, `#template-name`, `#template-source`, `#template-category`, `[role="option"]` texts, `[aria-label="Column title"]`, `[aria-label="Move down"]`, `[aria-label="Remove column"]`, `fieldset > div:nth-of-type(n)`, `[role="dialog"] button[type="submit"]`, "Template saved.", row with "Edit"/"Delete" buttons | MUST change: column selectors (README: "Column :position title", drag handle, "Delete column “:title”", no `fieldset>div`), reorder via keyboard (Space, ArrowDown, Space) or via the dnd handle; `Edit` stays a button on the card, `Delete` moves into the editor (README footer). Ids and `#template-*` kept |
| `[P08a-07d]` delete keeps retro columns | "Delete" in row, `[role="dialog"]` "Delete this template?", "Retrospectives created from it keep their columns.", "Template deleted.", "No workspace templates yet." | MUST change: Edit -> "Delete template" -> `[role="alertdialog"]` -> confirm "Delete template"; description text per R3 |
| `[P08a-07c]` (new-retro dialog) | group 1 | not mine |

New tests (file `tests/Browser/Walkthroughs/Plan18eWorkspaceTest.php`, ids `[P18e-09-nn]`):
- `[P18e-09-01]` manager creates a team from the dialog (dialog "New team", submit "Create team"), opens it, reaches members via "Invite people".
- `[P18e-09-02]` Leave workspace needs the typed name; the last owner sees "A workspace needs at least one owner." in the dialog.
- `[P18e-09-03]` create workspace from `workspaces/create` with no workspace; sidebar does not break.
- `[P18e-09-04]` members: change role, remove with confirmation, error for the last owner; admin cannot see an owner's select.
- `[P18e-09-05]` invite, link alert (mail driver log), Resend (new link), Revoke, "Expired" badge.
- `[P18e-09-06]` owner deletes the workspace with typed name.
- `[P18e-09-07]` templates: duplicate and edit, edit, delete.
- Visual: add the three pages to the `tests/Browser/Visual` capture list and `pages/dev/sections/workspace.tsx` (dev section) for the harness, FR+EN, 1440 and 390.
Vitest: `TemplateEditor` adapters (draft<->payload), `use-router-action`, LeaveWorkspaceDialog name matching.

## 9. Risks and open questions

| # | Risk (file) |
|---|---|
| R1 | `resources/js/app.tsx` default layout is still the OLD `@/layouts/app-layout` (-> `layouts/app/app-sidebar-layout`); the new `layouts/skrum/app-layout.tsx` takes `active` and `breadcrumbs` as props, but pages cannot pass props to a layout resolved by name in `app.tsx`. admin/about pages bypass it (`return null` + `AdminShell`). The convention for `active`/breadcrumbs (Inertia v3 `setLayoutProps` / `useLayoutProps`, or per-page `layout`) is not set yet. The first 18e screen to switch the default must fix it; this group depends on it. |
| R2 | Shared deletions: `template-chips.tsx` (also `teams/new-retro-dialog.tsx`, group 1), `confirm-form-dialog.tsx` (also `teams/show.tsx`, `settings/revoke-token-dialog.tsx`), `workspace-switcher.tsx` (imported by old `components/app-sidebar.tsx`). Delete each in the commit of its LAST consumer; otherwise leave to 18g. |
| R3 | `TemplateEditor` delete description reads "Retros already created from it are not affected." (template-editor.tsx l.1540); test 07d and the lang key say "Retrospectives created from it keep their columns.". Either change the component string (one line, no test change) or the test. Recommend the component. |
| R4 | `useSidebarModel` with `currentWorkspace === null` (user with no workspace on `workspaces/create`): `team` null, `workspaces` empty; the sidebar mockup assumes a team. Check `skrum/app-sidebar.tsx` renders without team (not verified). |
| R5 | `TemplateEditor` has no slot for server errors `category` and `columns` (array-level): verify they surface (summary count only?). |
| R6 | A 403 on role PATCH (admin touching an owner) is not a validation error: Inertia default modal. UI hides the select for that case, so reachable only by tampering; keep. |
| R7 | `ConfirmDialog`/`FormDialog` are promise-based and close on resolve, while Inertia redirects (leave/delete workspace redirect to `dashboard`): resolve in `onSuccess` and let the visit replace the page; check no state update after unmount. |
| R8 | Radix `Select name="role"` in the invite form submits via hidden input (as today); with `TextField` wrappers the Inertia `<Form>` must still see `email`. |
| R9 | Colour classes: `columnColorClass` maps both server and design colours; `TemplateColumn.color` type (`lib/retro/types`) changes with B10 (shared file with the retro group). |
| R10 | `teams` page prop of `workspaces/show` has the same shape as the shared `teams` (B16): no collision, but do not rename. |
| R11 | `TranslationKeysTest` scans literal `t('…')`: every new string (about 25: "New team", "Invite people", "Manage templates", "Resend", "Copy link", "Copy of :name", "Danger zone", typed-name prompts, empty invitation list, "N teams", role sublines) in en/fr/es/de; lang JSON files are shared with every group. |

Decisions needed (product owner):
- D1 Templates page "Use" button and tabs (Poker, Whiteboard): omit (no back end, whiteboard templates are on the team page) or add a read-only link block "Whiteboard templates are managed on each team page"? Recommended: omit tabs, show only the retro section.
- D2 Use the full `RetroTemplatePicker` (built-in + workspace tabs, detail panel, "Duplicate and edit" on built-ins too) as the templates page body instead of a workspace-only card grid? Mockup frame c shows only workspace cards; recommended: cards; built-ins duplicable only through "Start from a built-in template" in the editor.
- D3 Until B10 lands, templates use the six server colours (editor `colors={serverColumnColors}`); acceptable?
- D4 Typed-name confirmation for Delete workspace and the members-page Leave (mockup shows it for Leave only): extend to both?
- D5 Invitation Revoke without confirmation (as today) or with a confirm?
- D6 "Invite people" shown to managers only; members never see the members page (server 403): confirm no read-only members list for plain members.

## 10. Size

- Containers to write: 11 (+1 hook), 3 pages rewritten, 1 dev section, 1 new browser file, ~3 Vitest files.
- Old files deleted: 0 sure (pages rewritten in place); up to 3 conditional (`workspace-switcher.tsx`, `templates/template-chips.tsx`, `confirm-form-dialog.tsx`).
- Tests touched: 3 existing Plan08a tests (07a, 07b, 07d), ~7 new.
- Parallel with other groups: yes after the layout switch (R1). Shared files touched: `lang/{en,fr,es,de}.json`, `resources/js/types/workspaces.ts` (only if types extended), conditional deletions above, `tests/Browser/Visual` list, `pages/dev` sections index. No change to `app.tsx`, channel hooks or reducers by this group.
