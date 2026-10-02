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
| The first activity line says "Retro in progress", not "Retro live now": the server knows the phase of a retro, not whether people are in it | new row |
| The second activity line is always the poker games; the mockup shows "1 whiteboard edited today" on one tile | new row |
| "Open" ends with the lucide arrow, not the character "→" (rule 9) | new row |
| The first consequence of leaving lists the teams the person belongs to, joined by `Intl.ListFormat` ("Atlas, Borealis, and Comet" in English); above three teams it says "You leave n teams." | new row |
| "You're the only admin of this workspace." when no other admin exists (the mockup has no such case) | new row |
| "View templates" for a member, in place of "Manage templates" | new row |
| The dashed tile says "Teams share the templates of this workspace." (the mockup's "Teams share this workspace templates" is not a sentence) | new row |
| Workspace creation: the name only; no logo, no default language, no "Continue" | PB-23, D-33 |
| The switcher is the dropdown of the sidebar on a phone too, not a full-screen drawer | not built here (sidebar, Task 0) — new row |

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
| No "See all 11": every member is listed | new row |
| "Revoke" is a button with the cross and its label, not a bare cross | new row (rule 6: a destructive action has an icon and a label) |
| An expired invitation says "Expired" in place of "Invitation pending" | new row (existing feature, parity row 16) |
| The line under the address of an invitation starts with its role ("Member · Invited on Sep 26") | new row (existing feature: the role of an invitation was a badge) |
| The viewer's own row has the "…" menu, with "Leave" | new row (existing feature, parity row 6) |
| An owner seen by an admin has a badge and no select | new row (existing rule of the server) |
| The link of an invitation just sent, in a band under the header | new row (existing feature, parity row 15) |
| Under 36rem of card the table is a list of blocks; the role stays a select in the row, not in a drawer | new row |
| The page has a "Delete workspace" card under the members card | new row (existing feature, parity row 19) |
