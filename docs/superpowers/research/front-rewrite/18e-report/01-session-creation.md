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
| "Votes per person" has an "Automatic" switch beside the stepper | D-40 (awaiting the owner) |
| "Icebreaker at the start" has a switch beside the select | D-40 (awaiting the owner) |
| "Automatic AI summary" row | D-41 (awaiting the owner) |
| "Health check" help reads "The team rates its health statements first" (the mockup: "6 statements, before the ROTI", false here: the count varies and the phase comes first) | D-44 (awaiting the owner) |
| The colour palette shows the six server colours with their names, not eight | D-42 (awaiting the owner); K20, until R1 |
| "Delete column" beside the palette title | D-42 (awaiting the owner) |
| A shortcut shows its category ("Essentials"), the mockup "Classic" | D-43 (awaiting the owner) |
| "All templates" and "Browse" open the same full picker in place of the shortcuts; the picker shows its own read-only preview above the editable list | D-43 (awaiting the owner) |

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
| Deck tiles are the cards of `DeckPicker` (name, "n cards", value chips, badge; two per row in the dialog) and not the mockup's four small tiles with the values in mono; the list is taller, so the Tasks block is below the fold of the dialog with six decks | D-37, D-38 (awaiting the owner; D-38 is the one to decide first) |
| "Create a deck" is the dashed card at the end of the grid, not a "New deck" button in the section header | D-39 (awaiting the owner) |
| The value preview under the grid is the picker's strip of large cards on a canvas, with the deck's name | D-37 (awaiting the owner) |
| "Anonymous votes" row | D-41 (awaiting the owner) |
| "Auto reveal" and "Anonymous guests allowed" open off (the mockup shows them on): the defaults of today are kept | D-44 (awaiting the owner) |
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

## Task 1.4 — Icebreaker form

### Parity (brief 01 §3 has no row for this type: the fields are those of `games/new-room-dialog.tsx`, which G1 rewrites)

| Action | New control | Done |
|---|---|---|
| Open the room creation form from the team page | "New session", then the type radio "Icebreaker" ("Warm-up games"); always passed to the dialog | yes |
| Name, required, max 60, focused, empty | `#new-icebreaker-name`, label "Name" | yes |
| First game | `IcebreakerGameGrid` (radiogroup "Choose an icebreaker") of `IcebreakerGameCard`s from `gameOptions`; the first available game is preselected; an unavailable game is `aria-disabled` with its reason ("No GIF provider configured" for the GIF game, "Not available" otherwise) | yes |
| Who can join | block "Access", row "Who can join", `Select #new-icebreaker-access`: "Team members only" (default), "Anyone with the link" | yes |
| Create the room | "Create & open", POST `teams.games.store` (`name`, `game`, `access`), redirect to the room; "Cancel" beside it | yes |
| Validation errors | `name` (also the server's room-limit message) under the name, `game` under the cards, `access` in its row | yes |
| Room limit | the type tile is disabled with "This team already has :count game rooms." (`roomLimitReason`) when `canCreateGameRoom` is false | yes |

The room creation of `games/index` ("New room") is untouched.

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Poll tile and its form | no `poll` form prop on `NewSessionDialog`; the type options are a list built from the forms passed | SV-1 |
| "Schedule…" in the footer | `secondaryAction` of `IcebreakerSessionFormProps`, passed to `SessionFormFooter` | SE-2 |

### Differences with the mockup

ScreenSessionCreate draws the Icebreaker tile only, not its form: the form is built from its neighbours (same two columns, same name field, same settings row, same footer) and from `IcebreakerGameCard`.

| Difference | Row |
|---|---|
| Four types, no Poll | D-09 |
| The Icebreaker tile shows `Sparkles` and the Retro tile `Layers` | not a difference: the tiles of the mockup show `sparkles` and `layers` (`party-popper` and `sticky-note` are in the page behind the dialog and in the icebreaker row) |
| Game cards have no duration and no player range: the server has no such data (`IcebreakerGameCard` hides the line) | no row: reason N, already the component's documented behaviour |
| The pitches are new sentences ("One draws, the others guess.", …): the bench's pitches name a 60-second limit and "3 emojis", which the games do not guarantee | no row: reason F |
| No "Schedule…", no invitation link | D-06, D-08 |
| The type row of the bench dialog shows one tile (only the icebreaker form is passed there) | bench only |

## Task 1.5 — Saved decks page

### Parity (brief 01 §3 rows 30–34, brief 03 §3 rows 61–63, brief 04 §3 rows 42–44)

| # | Action | New control | Done |
|---|---|---|---|
| 30 / 61 | Open "Saved decks" | the "Saved decks" link of the poker section of `teams/show` opens the page `teams/{team}/poker-decks` (3-D3); it moves to the "…" menu in 4.1 | yes |
| 31 | Empty list | "No saved decks yet." in the creation tile (the grid is never empty: the built-in decks are always listed); under the grid for a user who cannot create | yes |
| 32 / 62 / 42 | Create a saved deck | "Create a deck" (header button) and the dashed tile "Create a custom deck" open `DeckEditor` in a dialog: `#deck-new-name` (required, 40), `#deck-new-cards` (a comma list is split), `#deck-new-unknown`, `#deck-new-coffee` (both on), "Save"; POST `teams.pokerDecks.store` | yes |
| 33 / 63 | Edit a saved deck | "Edit" on the card (named "Edit :name"), the same dialog titled "Edit :name", ids `deck-{id}-*`; PATCH `teams.pokerDecks.update`, or `workspaces.pokerDecks.update` for a workspace deck | yes |
| 34 / 63 | Delete a saved deck | "Delete" on the card (named "Delete :name"), then `ConfirmDialog` (`alertdialog`): "Delete this deck?", "Games that use it keep their cards.", "Delete deck"; DELETE `teams.pokerDecks.destroy` or `workspaces.pokerDecks.destroy`; focus goes to the page title | yes |
| 43 | Validation errors | `name` under the name, `cards` and `cards.N` under the values, in the dialog, which stays open | yes |
| 44 | Edit and Delete only for who may manage | `canManage` of the deck (its creator or a workspace admin; a workspace deck: a workspace manager only) | yes |
| — | A request the server refuses (403, 404) | the page is reloaded and the dialog closes, as the old dialog did | yes |
| — | Deck limit (30 per team) | at the limit "Create a deck", the tile and every "Duplicate" are not offered and the sentence "This team already has 30 saved decks." is shown; a refusal of the server is shown as a toast | yes |

Added by the spec (B21) and the mockup: built-in decks listed locked ("Built-in") with "Duplicate"; "Default" badge; "Set as default" on every other card for who can update the team; "Duplicate" on every card for who can create (a team deck through `teams.pokerDecks.duplicate.store`; a built-in deck and a workspace deck are posted to `teams.pokerDecks.store` under "Copy of :name", numbered while the name is taken); usage of the deck by the games of the team; "Workspace" badge; author of a custom deck.

### Places left

None: the "Saved decks" panel of ScreenPokerQueue has no element left for a later plan. (Its neighbour, "Estimation history", is Task 3.3.)

### Differences with the mockup

| Difference | Row |
|---|---|
| The header button reads "Create a deck" (the mockup: "New deck") | owner answer 1-D7 |
| The page sits in the application layout (sidebar, topbar with the breadcrumb "team › Saved decks"); "Back to the team" is a link above the title, not a bar of its own panel, and the breadcrumb is not "Atlas › Planning poker" | D-46 (awaiting the owner) |
| "Set as default" on each card that is not the default: the mockup only shows the badge. With it the footer of a card takes two lines at 15rem | D-45 (awaiting the owner) |
| "Delete" on a custom card (the mockup: Edit and Duplicate only) | D-45 (awaiting the owner) |
| "Workspace" badge on a workspace deck | D-45 (awaiting the owner) |
| The usage reads "13 values · 31 games" and "Custom · by Malik K · 4 games" as the mockup; the plan's "Used n times" is not used | plan text against the mockup: the mockup wins |
| Four built-in decks (Fibonacci, Modified Fibonacci, T-shirt sizes, Powers of 2) with the product's cards; the mockup shows two built-in decks and "Powers of 2" as a custom deck | D-45 (awaiting the owner) |
| The footer buttons of a custom card are grouped on the left (the mockup: Edit left, Duplicate right) | D-45 (awaiting the owner) |
| The editor opens in a dialog; the mockup has no frame for the editor on this page | D-46 (awaiting the owner) |
| "No saved decks yet." in the creation tile when the team has none | no row: parity row 31, the mockup has no empty state |
| FR: the title is "Jeux de cartes enregistrés" and the locked label "Intégrée" (the mockup: "Decks enregistrés", "Intégré"): existing translations of keys shared with other screens | no row |

## Review of Group 1 (2026-10-02)

- Enter in the template search, and in the name of the deck editor, no longer creates the session: the search ignores Enter, the deck name takes the deck ("Use this deck") when it has two values.
- A saved deck deleted by someone else: the form reloads `pokerDecks` and goes back to the default deck.
- An intent naming a type the user cannot use (`?new=whiteboard` without the right) no longer opens the dialog.
- Known and accepted: the dialog is a `Drawer` below 768 px and a `Dialog` above, two trees. Crossing 768 px while it is open (rotation, resize) resets what was typed. Keeping it needs the state of the four forms lifted above the switch; not done.
- Rows D-37 to D-46 of the plan carry the differences that had no row. They await the owner's word.
