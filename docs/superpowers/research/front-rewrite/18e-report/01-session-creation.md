# Group 1 — Session creation

## Task 1.1 — New session dialog shell with the retro form

### Parity (brief 01 §3, rows 1–19, 53, 54)

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Open the creation dialog | one "New session" button in the header of `teams/show` (1-D2); Retrospective preselected; the catalogue is reloaded (`only: ['catalogue']`) when the form mounts without it | yes |
| 2 | Name, default `Retro :date`, max 120 | `#new-retro-title`, label "Name" | yes |
| 3 | Search templates | after "Browse": `RetroTemplatePicker` search, `[aria-label="Search templates"]` | yes |
| 4 | Filter by category | after "Browse": `[aria-label="Category"] button`, `aria-pressed` | yes |
| 5 | Pick a template | five shortcut radios (`topTemplates`) in the radiogroup "Retrospective template"; the full picker after "Browse" (tabs Built-in / My workspace) | yes |
| 6 | Preview the chosen template | the editable column list under the template; after "Browse" also `section[aria-label="Template preview"]` | yes |
| 7 | Empty board | "Start from scratch" in the full picker (key `custom`) | yes |
| 8 | No match | `No template matches ":query"` | yes |
| 9 | Catalogue loading | six skeleton tiles, `aria-busy`; the picker's own loading state after "Browse" | yes |
| 10 | Selection fallback | `defaultTemplateKey`: intent, then first shortcut, then first built-in | yes |
| 11 | Anonymous cards | `Switch #new-retro-anonymous` | yes |
| 12 | Health check | `Switch #new-retro-health-check` | yes |
| 13 | Icebreaker and its game | `Switch #new-retro-icebreaker`, `Select #new-retro-icebreaker-game` shown when on | yes |
| 14 | "Settings" collapsible | removed: the settings column is always visible | yes |
| 15 | Vote limit automatic or fixed | `Switch #new-retro-votes-auto` ("Automatic") and a stepper 1–20 named "Votes per participant"; the automatic hint is the row's help | yes |
| 16 | Automatic AI summary | `Switch #new-retro-ai-summary`, last row, with the provider sentence; only when a provider is configured | yes |
| 17 | Create | "Create & open", `[role="dialog"] button[type="submit"]`; Enter in the name submits | yes |
| 18 | Cancel | "Cancel" | yes |
| 19 | Validation errors | under the name, the template, the columns and the two rows that have a server rule | yes |
| 53 | Switch type inside the dialog | `SessionTypePicker` (`variant="inline"`); each visited form stays mounted, so its state is kept; only the retro form is passed until 1.2 | yes |
| 54 | Mobile | full-height `Drawer` below 768 px, type row scrolls sideways, footer fixed at the bottom | yes |

Added by rule 13 (M1, M2): editable column list (`columns`), "Anonymous guests allowed" (`guest_access_enabled`), "Save as team template".

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Max per card", "Timer per phase" rows | `settingRows`, the list of `RetroSessionFields` (between "Votes per person" and "Icebreaker at the start") | SE-3, RT-3 |
| "Schedule…" beside "Create & open" | `secondaryAction` of `RetroSessionFormProps`, passed to `SessionFormFooter` | SE-2 |
| Poll tile | no `poll` form prop on `NewSessionDialog`; the type options are a list built from the forms passed | SV-1 |

### Differences with the mockup

| Difference | Row |
|---|---|
| Four types at most, no Poll; one trigger on the team page | D-09 |
| The Sessions page behind the dialog; no "Schedule…" | D-06 |
| No "Max per card", "Timer per phase", "ROTI at the end" | D-07 |
| No invitation link and "Copy link"; the header says "Team :team" only | D-08 |
| Type tiles read "Retro", "Planning poker", "Whiteboard", "Icebreaker" (the mockup: "Poker") | plan, "Browser tests that change" (the type radio "Planning poker") |
| "Votes per person" has an "Automatic" switch beside the stepper | no row: parity row 15, named in the task's composition |
| "Icebreaker at the start" has a switch beside the select | no row: parity row 13 |
| "Automatic AI summary" row | no row: no mockup, named in the task's composition |
| "Health check" help reads "The team rates its health statements first" (the mockup: "6 statements, before the ROTI", false here: the count varies and the phase comes first) | no row: reason F |
| The colour palette shows the six server colours with their names, not eight | K20, until R1 |
| "Delete column" beside the palette title | no row: named in the task's composition |
| A shortcut shows its category ("Essentials"), the mockup "Classic" | no row: the catalogue's own category |
| "All templates" and "Browse" open the same full picker in place of the shortcuts; the picker shows its own read-only preview above the editable list | no row: 1-D3 |
