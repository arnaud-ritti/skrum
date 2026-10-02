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
