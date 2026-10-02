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

## Task 1.2 — Poker form on DeckPicker and DeckEditor

### Parity (brief 01 §3, rows 20–29)

| # | Action | New control | Done |
|---|---|---|---|
| 20 | Open the poker creation form | "New session", then the type radio "Planning poker" (1-D2); the "New game" trigger of the poker section is gone | yes |
| 21 | Name, default `Poker :date`, max 120 | `#new-poker-title`, label "Name" | yes |
| 22 | Choose a deck (built-in, saved) | `DeckPicker`, radiogroup "Deck": the four built-in decks, then the decks of the team ("Saved") and of the workspace ("Workspace"); the team's default deck is preselected, `?deck=` wins | yes |
| 23 | Custom deck: cards, `?` and `☕` | "Create a deck" opens `DeckEditor` in place of the picker: `#deck-custom-cards`, `#deck-custom-unknown`, `#deck-custom-coffee`, both on. "Use this deck" returns to the picker with the deck selected ("This game only", "Edit"); "Create & open" with the editor open takes the deck being typed | yes |
| 24 | Save the custom deck for the team | `#deck-custom-name` ("Name (optional)"): a named deck is sent as `save_deck_as` | yes |
| 25 | Deck errors of the server | `custom_cards`, `custom_cards.N` → the editor's values; `save_deck_as` → the editor's name (the editor reopens); `deck`, `saved_deck_id` → under the picker. Duplicates and `?`/`☕` typed as values are refused by the editor before the server | yes |
| 26 | Anonymous votes | `Switch #new-poker-anonymous` | yes |
| 27 | Reveal automatically | `Switch #new-poker-auto-reveal`, label "Auto reveal" (mockup) | yes |
| 28 | Create the game | "Create & open", POST `teams.pokerGames.store` | yes |
| 29 | Cancel | "Cancel" in the footer | yes |

Added by rule 13 (M2, M3): Tasks ("Type them", one title per line, 50 at most, a counter; "Later", preselected), Facilitator in "Watch only" (`spectator`, `#new-poker-spectator`), "Anonymous guests allowed" (`guest_access_enabled`, `#new-poker-guests`).

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Tasks tab "Import from Jira" | `tabs`, the list of `PokerTasksField` (before "Type them"), with its own `TabsContent` | SE-3 |
| "Timer per task", "Change vote after reveal", "Write estimates to Jira" rows (and the note about Jira under them) | `settingRows`, the list of `PokerSessionFields` (after "Facilitator in “Watch only”") | SE-3 |
| "Schedule…" in the footer | `secondaryAction` of `PokerSessionFormProps`, passed to `SessionFormFooter` | SE-2 |

### Differences with the mockup

| Difference | Row |
|---|---|
| No "Import from Jira" tab, no "Timer per task", "Change vote after reveal", "Write estimates to Jira", no Jira note | D-07 |
| No "Schedule…" | D-06 |
| No invitation link and "Copy link" | D-08 |
| Deck tiles are the cards of `DeckPicker` (name, "n cards", value chips, badge; two per row in the dialog) and not the mockup's four small tiles with the values in mono; the list is taller, so the Tasks block is below the fold of the dialog with six decks | no row: the task's composition and `DeckPicker/README.md` |
| "Create a deck" is the dashed card at the end of the grid, not a "New deck" button in the section header | no row: `DeckPicker/README.md`, plan "Browser tests changed" |
| The value preview under the grid is the picker's strip of large cards on a canvas, with the deck's name | no row: `DeckPicker/README.md` |
| "Anonymous votes" row | no row: no mockup, named in the task's composition |
| "Auto reveal" and "Anonymous guests allowed" open off (the mockup shows them on): the defaults of today are kept | no row: parity rows 27, and 1.1 for the guests |
| FR: "Facilitateur en « Regarder seulement »" (the mockup: « Watch only »): the name the room gives that mode in French | no row |
| The type row of the bench dialog shows one tile (only the poker form is passed there) | bench only |

## Task 1.3 — Whiteboard form and template gallery, templates manager

### Parity (brief 01 §3, rows 36–46)

| # | Action | New control | Done |
|---|---|---|---|
| 36 | Open the whiteboard creation form | "New session", then the type radio "Whiteboard" (1-D2), offered when `canCreateWhiteboard`; the "New whiteboard" trigger of the whiteboards section is gone. The gallery is reloaded (`only: ['whiteboardGallery']`) when the form mounts without it, that is when the type is first chosen | yes |
| 37 | Name, required, max 120, focused, empty | `#whiteboard-title`, label "Name" | yes |
| 38 | Pick a template | `WhiteboardTemplateGallery`: two radiogroups named "Template" (built-in, then "Workspace templates"), tiles = preview surface, name, description; arrows move and select; Blank preselected, `?template=` (a key or a workspace template id) wins. A built-in sends `template`, a workspace template sends `workspace_template_id` alone | yes |
| 39 | Template errors | `template` or `workspace_template_id` under the gallery | yes |
| 40 | Gallery loading | six skeleton tiles, `aria-busy` | yes |
| 41 | Create the board | "Create & open", POST `teams.whiteboards.store`; "Cancel" beside it | yes |
| 42 | Open the templates manager | the "Whiteboard templates" button of the whiteboards section, unchanged (it moves to the "…" menu in 4.1) | yes |
| 43 | Edit a template | "Edit" in the row (named "Edit :name"), inline form: name (80, required), description (300), "Save" / "Cancel"; a refused request reloads the two lists | yes |
| 44 | Delete a template | "Delete" in the row (named "Delete :name"), then `ConfirmDialog` (`alertdialog`): "Delete this template?", "Boards already created from it are not changed." (1-D8) | yes |
| 45 | No template | `EmptyState`: "No whiteboard templates yet.", "Save a board as a template from its menu." | yes |
| 46 | Edit and Delete only for who may manage | `template.canManage` | yes |

Added by rule 13 (M2): "Anonymous guests allowed" (`guest_access_enabled`, `#new-whiteboard-guests`).

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Schedule…" in the footer | `secondaryAction` of `WhiteboardSessionFormProps`, passed to `SessionFormFooter` | SE-2 |
| Settings of a whiteboard (none in the product today) | the right column of `WhiteboardSessionFields` holds the "Invitation" block only; a "Settings" block goes above it | — |

### Differences with the mockup

ScreenSessionCreate draws the retro and the poker variants only: the whiteboard form has no mockup and is built from its neighbours (same two columns, same name field, same "Invitation" row, same footer).

| Difference | Row |
|---|---|
| No invitation link and "Copy link" | D-08 |
| No "Schedule…" | D-06 |
| The right column holds one row ("Anonymous guests allowed"): a whiteboard has no other creation setting | no row: no mockup |
| The preview paper is white in the dark theme (`--color-whiteboard-paper`), and the grey bar of a scene text is `--color-whiteboard-paper-line` | spec ruling 36, 1-D5 |
| The templates manager is a plain dialog with rows (no mockup); "Save" and "Edit" labels are not wrapped in a truncating span, because the browser suite binds `button:text-is("Save")` and `button:text-is("Edit")` | no row: browser contract |
| The type row of the bench dialog shows one tile (only the whiteboard form is passed there) | bench only |
