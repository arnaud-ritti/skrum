# Group 9 — Workspace

## Task 9a — Workspace page and workspace creation

Nothing ran: no Pest, Vitest or browser test, no capture (owner decision). The table below is read from the code, not walked on a running page.

### Parity (brief 09 §3, rows 1–10)

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Page title and subtitle | `h1` with the workspace name beside its mark; subline "n teams · n members · you're an admin / the owner / a member" (M22); `<Head title={workspace.name}>` | yes |
| 2 | Create a team (manager) | "New team" in the header and the dashed tile open a `FormDialog`: `input[name="name"]` named "New team name", required, 100 characters, submit "Create team", server error in the dialog | yes |
| 3 | Open a team | one tile per team, `a[data-slot="team-tile"][href$="/teams/{id}"]`: mark, name, three activity lines (PB-13), member stack and count (M22), "Open" | yes |
| 4 | Empty states | "No teams yet. Create the first one." above the dashed tile for a manager; "You are not a member of any team yet." for a member | yes |
| 5 | Leave the workspace | "Leave workspace…" at the foot of the page; the confirmation unfolds under the row (`role="alertdialog"`), a dialog under 768 px (PB-18); the typed name enables "Leave :name"; the refusal of the server ("A workspace needs at least one owner.") is shown in it | yes |
| 6 | Leave from the members page | `LeaveWorkspaceDialog({ open, onOpenChange, workspace })` is exported for 9b | 9b |
| 7 | Link to the members | "Invite people" in the header, managers only, `a[href$="/members"]` | yes |
| 8 | Link to the templates | "Manage templates" ("View templates" for a member, who cannot manage them) in the Teams heading row | yes |
| 9 | Create a workspace | card "Name your workspace" (PB-23): `#name`, label "Workspace name", button "Create workspace", error under the field | yes |
| 10 | Switch workspace, "New workspace", "Select a workspace" | sidebar switcher: each workspace has its mark, "n teams · Role" and a check on the current one (M23, PB-19: no shortcut) | yes |

Back end added in this task (PB-13 and PB-18 put it in 9.0a, which was already merged without it): on `workspaces/show`, `otherAdminName` (managers only) and, on each team, `isMember` and `activity` (`openRetroTitle`, `lastRetroAt`, `openPokerGames`, `openActionItems`, `overdueActionItems`).

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Description of a team, under its name on the tile | `slots.teamDescriptionFor` of `WorkspaceOverview` → `description` of `TeamTile` | WS-1 |

The three activity lines are built (PB-13 A); they are no longer a place left.

### Differences with the mockup

Captures were not made; the list is read from the code against `ScreenWorkspace/preview.html`.

| Difference | Row |
|---|---|
| No description line on a team tile; the mark takes one of the eight column colours from the team id | PB-20, D-24 |
| No `⌘2`, `⌘3` in the switcher | PB-19 |
| The first activity line says "Retro in progress", not "Retro live now": the server knows the phase of a retro, not whether people are in it | D-91 |
| The second activity line is always the poker games; the mockup shows "1 whiteboard edited today" on one tile | D-91 |
| "Open" ends with the lucide arrow, not the character "→" (rule 9) | D-91 |
| The first consequence of leaving lists the teams the person belongs to, joined by `Intl.ListFormat` ("Atlas, Borealis, and Comet" in English); above three teams it says "You leave n teams." | D-92 |
| "You're the only admin of this workspace." when no other admin exists (the mockup has no such case) | D-92 |
| "View templates" for a member, in place of "Manage templates" | D-91 |
| The dashed tile says "Teams share the templates of this workspace." (the mockup's "Teams share this workspace templates" is not a sentence) | D-91 |
| Workspace creation: the name only; no logo, no default language, no "Continue" | PB-23, D-33 |
| The switcher is the dropdown of the sidebar on a phone too, not a full-screen drawer | not built here (sidebar, Task 0) — D-91 |

## Task 9b — Members, roles and invitations

Nothing ran: no Pest, Vitest or browser test, no capture (owner decision). The table below is read from the code, not walked on a running page.

### Parity (brief 09 §3, rows 11–20)

| # | Action | New control | Done |
|---|---|---|---|
| 11 | Members list: name, e-mail | one card with one table (PB-16 A): avatar (PB-22), name, "(you)" on the viewer, e-mail; `[data-slot="member-row"][data-member-id]`; under 36rem of card a row is two lines | yes |
| 12 | Change a role | `Select` named "Role" on the row; owner, admin, member for an owner, admin and member for an admin; fires on change; the refusal of the server under the select (`[data-slot="member-role-error"]`). An admin sees an owner as a badge "Owner", with no select and no menu | yes |
| 13 | Remove a member | "…" menu of the row ("Actions for :name") → "Remove from workspace" ("Retirer" in French) → `ConfirmDialog` (`alertdialog`) "Remove :name from this workspace?", the same description as before; the refusal of the server in the dialog | yes |
| 6 | Leave from one's own row | "…" menu → "Leave" → `LeaveWorkspaceDialog` (typed name, 9-D4), with "You're one of n admins — :name stays admin" computed from the list | yes |
| 14 | Invite | "Invite" in the card header opens a `FormDialog` "Invite people": `input[name="email"]` labelled "Email address", `Select name="role"` labelled "Role" (Member, Admin), submit "Send invitation"; the refusal of the server in the dialog; a toast "Invitation sent to :email." | yes |
| 15 | Invitation link when mail is only logged | a band under the card header: the same sentence, the read-only field, "Copy link" | yes |
| 16 | Pending invitations | rows of the same table: envelope, address, "Role · Invited on :date", badge "Invitation pending" or "Expired"; counted in the header ("n members · n pending invitations") | yes |
| 17 | Revoke | "Revoke" on the row → `ConfirmDialog` "Revoke the invitation of :email?" (9-D5); Cancel keeps it | yes |
| 18 | Resend | "Resend" on the row: the store route with the address and the role of the row; a toast; the new link in the band | yes |
| 19 | Delete the workspace (owner) | destructive card "Delete workspace" → `FormDialog` "Delete this workspace?" with the typed name (9-D4); `@delete-workspace-button`, `@delete-workspace-confirm` | yes |
| 20 | Heading | `h1` "Members", the name of the workspace under it, breadcrumb "workspace › Members", `<Head title="Members">` | yes |

Back end added in this task (PB-22, and the mockup's "Invited on" line): `avatarUrl` on each entry of `members`, `invitedAt` on each entry of `invitations`.

### Places left

| Mockup or roadmap element | Slot | Later |
|---|---|---|
| Teams the invited person joins | `slots.inviteTeamsField` of `MembersTable` → `InviteDialog`, under the role | IN-1 |
| Message of the inviter | `slots.inviteMessageField` of `MembersTable` → `InviteDialog`, last field | IN-2 |
| "Invitation link" button of the card header | `slots.headerAction` of `MembersTable`, before "Invite" | backlog (team invite link) |

### Differences with the mockup

No mockup of this page exists; the reference is the Members card of `ScreenSettings` frame a (PB-16). Captures were not made; the list is read from the code.

| Difference | Row |
|---|---|
| No "Last activity" column; "Resend" sits in the actions column, beside "Revoke" | PB-22 |
| Roles are Owner, Admin, Member (no facilitator, no observer); the footer explains these two manager roles | PB-22 |
| No "Invitation link" button in the header | D-30 (team invite link: backlog) |
| No "See all 11": every member is listed | D-93 |
| "Revoke" is a button with the cross and its label, not a bare cross | D-93 (rule 6: a destructive action has an icon and a label) |
| An expired invitation says "Expired" in place of "Invitation pending" | D-93 (existing feature, parity row 16) |
| The line under the address of an invitation starts with its role ("Member · Invited on Sep 26") | D-93 (existing feature: the role of an invitation was a badge) |
| The viewer's own row has the "…" menu, with "Leave" | D-93 (existing feature, parity row 6) |
| An owner seen by an admin has a badge and no select | D-93 (existing rule of the server) |
| The link of an invitation just sent, in a band under the header | D-93 (existing feature, parity row 15) |
| Under 36rem of card the table is a list of blocks; the role stays a select in the row, not in a drawer | D-93 |
| The page has a "Delete workspace" card under the members card | D-93 (existing feature, parity row 19) |

## Task 9c — Templates page: "All", the full picker, "Use", Poker and Whiteboard tabs

Built on PB-14 (option A), PB-15 (option A), PB-17 and PB-21, which win over the plan text: an "All" tab as the mockup, the "Retro" tab as the full picker. No test, capture or browser was run (owner decision); the differences below are read from the code and the mockup's `preview.html`.

### Parity (brief 09 §3, rows 21–38)

| # | Old behaviour | New control | Done |
|---|---|---|---|
| 21 | Templates list, read by every role: name, category, column chips | "All" tab: one card per template (`[data-test="workspace-template-{id}"]`): columns in their colours with their titles, name, "n columns · used n×", author with avatar, "Use". The category is read in the "Retro" tab: the picker's category filter and the badge of its preview | yes |
| 22 | Subtitle | "Templates shared by every team of this workspace" under the `h1` | yes |
| 23 | Empty state "No workspace templates yet." | the same sentence in a dashed block of the Retrospective section; "Create a template" for a manager | yes |
| 24 | New template (manager); the catalogue is loaded when the editor opens | "New template" in the page header → side sheet (`role="dialog"`) with `TemplateEditor` in create mode; `catalogue` is asked for when the editor opens on a new template or when the Retro tab opens, and again after a visit dropped it | yes |
| 25 | Start from a built-in template | `#template-source` of the editor; fills the name when it is empty, the category and the columns | yes |
| 26 | Name (80), category | `#template-name`, `#template-category` | yes |
| 27 | Column title, colour, description | "Column :position title", the colour picker, "Column :position help question" (TemplateEditor README) | yes (labels changed, listed in the plan) |
| 28 | Reorder columns | the handle "Reorder “:title”, position n of m": pointer, or Space, arrows, Space | yes (control changed, listed in the plan) |
| 29 | Remove a column (not the last) | "Delete column “:title”", with a 5 s "Undo" toast | yes |
| 30 | Add a column (10 at most) | "Add a column" | yes |
| 31 | Save (create) | submit "Save" → `workspaces.templates.store`; the sheet closes; "Template saved." | yes |
| 32 | Edit, save (update) | "Edit" in the "…" menu of a card, or "Edit" in the preview of the picker → the sheet in edit mode → `workspaces.templates.update` | yes |
| 33 | Delete a template | "Delete" in the "…" menu of a card, or "Delete template" in the editor → `alertdialog` "Delete this template?" / "Retros already created from it are not affected." (9-D7) → `workspaces.templates.destroy`; "Template deleted." | yes |
| 34 | Cancel | "Cancel" of the editor, Escape, a click outside the sheet | yes |
| 35 | Validation errors | `errors` of the visit handed to the editor (name, category, columns, each column); "n fields to fix" | yes |
| 36 | A member only reads | no "New template", no "…" menu, no Edit or Duplicate in the picker; "Use" stays | yes |
| 37 | Duplicate (new) | "Duplicate" in the "…" menu of a card and in the editor; "Duplicate and edit" in the picker, on a built-in template too (third round, point 16): the editor opens on a new template named "Copy of :name" | yes |
| 38 | Flash toasts | unchanged | yes |

Added by the owner's answers: "Use" on every card and in the picker (9-D1) — a link to the page of the current team with `?new=retro&template=<key>`, `?new=poker&deck=<id>` or `?new=whiteboard&template=workspace:<id>`, read there by `useNewSessionIntent`; without a team the button stays, inert (`aria-disabled`), with the hint "Pick a team first". The Poker tab lists the decks of the workspace (B30) with create, edit, duplicate and delete for a workspace manager; the Whiteboard tab lists the whiteboard templates with rename and delete for who may manage them.

Back end added in this task (PB-15, PB-21): `usageCount` on each entry of `templates` (the retros created from it), `author` as `{ name, avatarUrl }` or `null` on each entry of `templates` and of `pokerDecks`.

### Places left

| Mockup or roadmap element | Slot | Later |
|---|---|---|
| Visibility badge of a template | `slots.templateVisibilityFor` of `TemplatesPage` → `badge` of `TemplateCard`, beside the name | WS-2 |

### Differences with the mockup

| Difference | Row |
|---|---|
| The "Retro" tab is the full picker (built-in templates, categories, preview with "Use this template", "Duplicate and edit", "Edit"), not the card grid; the page's search field gives way to the picker's own there (one query for both) | PB-14 |
| A card has a "…" menu for a manager (Edit, Duplicate, Delete) | PB-21 |
| The line of a deck is its usage ("n games"), the section says "Deck values" | PB-21 |
| The whiteboard empty state has no button | PB-17 |
| The whiteboard empty state is the `EmptyState` component (its illustration and its "Whiteboard" overline), not the lagoon tile with the pen | D-94 |
| A whiteboard template card (the mockup shows none): outline of the board on white paper, name, description, "Use"; no author (the page is not sent one) | D-94 |
| "Create a deck" in the header of the Planning poker section, and a dashed empty block "No workspace decks yet." / "No workspace templates yet." when a kind is empty | D-94 (B30; parity row 23) |
| "New template" is shown to a manager only, and creates a retro template on every tab | D-94 (existing rule; decks have "Create a deck") |
| The column titles of a card's preview are read by assistive technology (the mockup hides the preview); they are set in the overline size (0.6875rem), the mockup's 0.625rem is outside the scale | D-94 (accessibility; rule 3) |
| No author line on a card whose author's account is gone | D-94 |
| Without a team "Use" is disabled with "Pick a team first" | D-94 (plan, 9-D1) |
| While searching, a section without a match is not shown; with none left, "No template matches “…”" and "Clear search" | D-94 |
| The editor opens in a side sheet (no frame in the mockup) without the sheet's close cross ("Cancel", Escape and a click outside close it) | D-94 |

