# Brief 01 — Session creation (plan 18e, group 1)

Read-only research. Verified by reading source and tests; nothing was run. "Not verified" items are listed in section 9.

## 1. Scope

| Item | Value |
|---|---|
| Pages touched | `pages/teams/show.tsx` (retro trigger import + props only; the page itself is group 4), `pages/games/index.tsx` (unchanged, keeps importing `NewRoomDialog`) |
| Routes (unchanged) | POST `teams.retros.store`, `teams.pokerGames.store`, `teams.whiteboards.store`, `teams.gameRooms.store` (TeamGameRoomsController@store), POST/PATCH/DELETE `teams.pokerDecks.*`, PATCH/DELETE `workspaces.whiteboardTemplates.*`; partial reloads `only:['catalogue']`, `only:['whiteboardGallery']`, `only:['pokerDecks']`, `only:['whiteboardTemplates','whiteboardGallery']` |
| Layout | AppLayout (dialogs open over `teams/show` and `games/index`); no layout change |
| Mockups | `ScreenSessionCreate` (retro 61rem dialog, poker variant; mobile = full-screen Drawer), `SessionTypePicker`, `RetroTemplatePicker`, `DeckPicker` (+ `DeckEditor`) READMEs and previews; `NewGameRoomDialog` is already built in `skrum/games-leaderboard.tsx` |
| Inventory sections | `inventory-pages.md` `pages/teams/show.tsx` §4 (lines ~916-1010: creation dialogs, saved decks, whiteboard templates), `pages/games/index.tsx` (new room), `inventory-components.md` lines 311-318, 583, 739, 886-891 |
| No mockup | Whiteboard creation form, Saved decks manager, Whiteboard templates manager: designed from neighbours (section 6) |

Boundary with group 4 (`teams/show`): group 1 owns the creation dialogs, `saved-decks-dialog.tsx`, `whiteboard-templates-dialog.tsx`, `whiteboard-template-preview.tsx`, and edits `poker-games-section.tsx` / `whiteboards-section.tsx` only to swap the trigger / dialog imports. The lists, delete-board dialog, health statements, members stay group 4. Spec §7 order (1 before 4) makes this sequential.

Boundary with other groups on shared helpers (do NOT delete in group 1): `components/poker/deck-fields.tsx` (also used by `poker/game-settings-dialog.tsx`, group 3), `components/retro/icebreaker-game-select.tsx` and `ai-summary-switch.tsx` (also used by `retro/settings-dialog.tsx`, group 2), `components/templates/template-chips.tsx` (also used by `pages/workspaces/templates.tsx`, group 9). Group 1 stops importing them; the last group to use each deletes it.

## 2. Commits

| # | Commit | Old files deleted |
|---|---|---|
| C1 | `feat(session-create): new session dialog shell with the retro form` — `NewSessionDialog` (type picker, header, sticky footer, Drawer on mobile), retro form, `SettingRow`, catalogue adapter; page `teams/show.tsx` import swap | `components/teams/new-retro-dialog.tsx` |
| C2 | `feat(session-create): poker form on DeckPicker and DeckEditor, saved decks dialog` | `components/teams/new-poker-game-dialog.tsx`; `saved-decks-dialog.tsx` rewritten in place (same path, same export) |
| C3 | `feat(session-create): whiteboard form and template gallery, templates manager` | `components/teams/new-whiteboard-dialog.tsx`; `whiteboard-template-preview.tsx` rewritten in place (tokens); `whiteboard-templates-dialog.tsx` rewritten in place |
| C4 | `feat(games): new room dialog on NewGameRoomDialog` — `components/games/new-room-dialog.tsx` becomes a thin `useForm` container; old body deleted | (rewritten in place) |

Each commit: lang keys in en/fr/es/de, Vitest for its adapter, edited browser tests (section 8), a `/dev/design-system` section `pages/dev/sections/session-create.tsx` and visual capture mirroring plan 18d (`tests/Browser/Visual/SessionCreateVisualTest.php`).

## 3. Parity table

Hooks column: what the browser suite binds to today (kept unless "CHANGES").

| # | Action | Old control (file) | Route / event | New component and control | Hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Open "New retrospective" | `NewRetroDialog` trigger (new-retro-dialog.tsx:58) | client; on mount reload `only:['catalogue']` if undefined | `NewSessionDialog` `trigger` Button, `defaultType="retro"`; form mounted only while open | button text "New retrospective" | Trigger label kept (D2) |
| 2 | Retro title, default `Retro :date`, max 120 | Input `#new-retro-title` | client | `Input` `#new-retro-title` (label "Name" per mockup) | `#new-retro-title`, prefilled value | `date` from `usePage().props.locale`, `dateStyle:'medium'` |
| 3 | Search templates | search Input `aria-label="Search templates"` | client | `RetroTemplatePicker` built-in search (same aria-label), debounce 300 ms, `/` shortcut | `[aria-label="Search templates"]` | OK as is |
| 4 | Filter by category | button group `aria-label="Category"`, `aria-pressed` | client | `RetroTemplatePicker` `categories={templateCategories}` (same group name and aria-pressed) | `[aria-label="Category"] button` | first button is "All" |
| 5 | Pick a template | `li button[aria-pressed]` grouped Workspace/Common/More | client | picker cards `[role="radio"]` in `role="radiogroup"` named "Retrospective template"; tabs Built-in / My workspace | CHANGES: `li button` -> `[role="radio"]`, `aria-pressed` -> `aria-checked` | Sections Common/More dropped (Tabs per mockup); sort common first in adapter |
| 6 | Preview chosen template (columns, descriptions) | right pane h3 "Preview" + `TemplateChips` | client | picker `DetailPanel` (`section[aria-label="Template preview"]`, mini-board with help text) | CHANGES: `h3:has-text("Preview")` | Dot colours now `bg-skrum-col-*`, not `bg-emerald-500` |
| 7 | Empty board | list item "Empty board"; preview text | client | picker "Start from scratch" card (`blankId='custom'`) | CHANGES: text "Empty board" -> "Start from scratch" / "An empty board: add your own columns." | server key `custom` |
| 8 | No match | "No templates match your search." | client | picker `EmptyState` `No template matches ":query"` | CHANGES text | |
| 9 | Catalogue loading | 4 Skeleton rows | lazy reload | picker `loading` (skeletons + `aria-busy`) | none | `loading={catalogue===undefined}` |
| 10 | Selection fallback (first non-workspace; visible) | derived in container | client | adapter `defaultTemplateKey(catalogue)`; picker roves to first visible | none | pure fn, Vitest |
| 11 | Anonymous cards | Checkbox `#new-retro-anonymous` | body `is_anonymous` | `Switch` in `SettingRow` `#new-retro-anonymous` | `#new-retro-anonymous`, `aria-checked` | |
| 12 | Health check | Checkbox `#new-retro-health-check` | `health_check_enabled` | `Switch` `#new-retro-health-check` | id, `aria-checked` | |
| 13 | Icebreaker + game | Checkbox `#new-retro-icebreaker` + Select `#new-retro-icebreaker-game` (only available + current) | `icebreaker_enabled`, `icebreaker_game` (default `draw`) | `Switch` `#new-retro-icebreaker` + `Select` `SelectTrigger id="new-retro-icebreaker-game"` shown when on; options `available` only, disabled otherwise | ids; `[role="option"]:has-text("Hangman")`; trigger text | own inline select (group 2 owns `IcebreakerGameSelect`) |
| 14 | Open "Settings" collapsible | Collapsible trigger "Settings" | client | removed: settings column always visible (mockup) | CHANGES: tests click `button:has-text("Settings")` / `[data-slot="collapsible-trigger"]` | delete those clicks |
| 15 | Vote limit auto/fixed | Checkbox `#new-retro-votes-auto`, number input min1 max20 aria-label "Votes per participant", hint "Automatic: number of cards plus 3, at most 10." | `votes_per_participant` null or 1-20 (default fixed 5) | `SettingRow` with `Switch` `#new-retro-votes-auto` + stepper (min 1, max 20, `aria-label="Votes per participant"`) | `#new-retro-votes-auto` (`aria-checked` true by default), hint text | `Switch` checked = automatic |
| 16 | Automatic AI summary (only if `llm.enabled && llm.provider`) | `AiSummarySwitch` `#new-retro-ai-summary` + provider disclosure | `ai_summary_enabled` (default `llm.enabled`) | `Switch` row `#new-retro-ai-summary`, help = the exact disclosure sentence with `:provider` | id, `aria-checked`, both strings | no mockup row: designed from neighbours |
| 17 | Start the retro | submit "Start" (disabled while processing / no template) | POST `teams.retros.store` body `title, template, is_anonymous, health_check_enabled, icebreaker_enabled, icebreaker_game, votes_per_participant, ai_summary_enabled`; `onSuccess` close; redirect `retros.show` | footer primary "Create & open" `type="submit"`, Enter submits | `[role="dialog"] button[type="submit"]` (all retro tests use this) | label per mockup (D1); poker/whiteboard tests do change |
| 18 | Cancel | "Cancel" | client | footer "Cancel" | `Cancel` | |
| 19 | Show validation errors | `InputError` under title, template, icebreaker_game, votes_per_participant | 422 | `errors.*` under each field, `aria-invalid` + `aria-describedby` | text | |
| 20 | Open "New game" | `NewPokerGameDialog` trigger | client | `NewSessionDialog` `defaultType="poker"` | button text "New game" | |
| 21 | Poker title, default `Poker :date`, max 120 | Input `#new-poker-title` | client | `Input` `#new-poker-title` | id + prefilled value (P10a-02 script) | |
| 22 | Choose deck (built-in, saved, custom) | `DeckFields` radiogroup (`[role="radio"]` x5; "Your team's decks" heading) | body `deck`, `saved_deck_id` | `DeckPicker` (`RadioGroup` aria-label "Deck", cards named ":name, :count cards") | CHANGES: `[role="radio"]:has-text("Team scale")` still works; count 5, `span span` chips, "Custom" radio, "Your team's decks" heading do NOT | built-in ids = `option.value`, saved ids = `saved.id` |
| 23 | Custom deck: cards, `?`/`☕` toggles | inputs `#deck-custom-cards`, `#deck-include-unknown`, `#deck-include-coffee` | `custom_cards[]`, `include_unknown`, `include_coffee` | "Create a deck" card -> inline `DeckEditor` (`idPrefix` default `deck-new`: `#deck-new-cards`, `#deck-new-unknown`, `#deck-new-coffee`), both switches default on | CHANGES: ids `#deck-custom-cards` -> `#deck-new-cards` etc. | DeckEditor README imposes tag-input + switches |
| 24 | Save custom deck for the team | Input `#deck-save-as` ("Save this deck for the team as…", max 40) | `save_deck_as` | `DeckEditor` name field (`nameRequired={false}`, `#deck-new-name`, label "Name (optional)", `saveLabel` "Use this deck") | CHANGES id | name present -> `save_deck_as` |
| 25 | Custom deck errors from server (`custom_cards`, `custom_cards.N`, `save_deck_as`, `deck`, `saved_deck_id`) | `InputError` | 422 | map to `DeckEditor.errors` `{ name, values }` | CHANGES: P10a-03 expects server text for `3, 3` ("Each card can appear only once.") — the editor now refuses duplicates itself ("Duplicate value: 3") | `?, ☕` only: editor says "Use the switches below for ? and ☕." and "Add at least 2 values."; server message "Add at least one card that can be an estimate." only reachable with one value + both specials: keep server error mapping |
| 26 | Anonymous votes | Checkbox `#new-poker-anonymous` | `anonymous_votes` | `Switch` row `#new-poker-anonymous` | id, `aria-checked` | not in mockup; neighbour row |
| 27 | Reveal automatically | Checkbox `#new-poker-auto-reveal` | `auto_reveal` | `Switch` row `#new-poker-auto-reveal` (mockup "Auto reveal / When everyone has voted") | id, `aria-checked` | label kept "Reveal automatically" |
| 28 | Create the game | "Create game" | POST `teams.pokerGames.store` + `deckPayload()` (saved -> `{deck:'custom',saved_deck_id}`; built-in -> `{deck}`; custom -> `{deck:'custom',custom_cards,include_unknown,include_coffee,save_deck_as?}`); redirect `poker.show` | footer "Create & open" | CHANGES: `click('Create game')` x3 | reuse `deckPayload`/`splitCustomCards` from `deck-fields.tsx` (keep file; move helpers to `lib/poker/deck-choice.ts` only if group 3 agrees) |
| 29 | Cancel poker dialog | "Cancel" | client | "Cancel" | `click('Cancel')`, `assertNotPresent('[role="dialog"]')` | |
| 30 | Open "Saved decks" | `SavedDecksDialog` trigger, always shown | client | `Dialog` + `DeckPicker` (+ `onEdit`, `onDelete`) | button text "Saved decks" | |
| 31 | Empty list | "No saved decks yet." | client | `EmptyState` same string | text | |
| 32 | Create saved deck | "New deck" -> inline form name (max 40), cards, `Add ?`/`Add ☕` | POST `teams.pokerDecks.store` `{name,cards[],include_unknown,include_coffee}`, `preserveScroll`; max 30 decks | `DeckPicker.onCreate` -> `DeckEditor` (`nameRequired`, `saveLabel` "Save") | CHANGES: "New deck" -> "Create a deck"; `#deck-new-name`, `#deck-new-cards`, `#deck-new-unknown`, `#deck-new-coffee` already match; "Save" kept | server duplicate name error -> `errors.name` ("A deck with this name already exists.") |
| 33 | Edit saved deck | "Edit deck" -> inline form prefilled (`draftFrom`) | PATCH `teams.pokerDecks.update` | `DeckPicker` per-card "Edit :name" (only `canManage`) -> `DeckEditor` `idPrefix={`deck-${id}`}` | CHANGES: "Edit deck" -> "Edit :name"; `#deck-{id}-cards` kept via idPrefix | `deckShapeFromCards()` replaces `draftFrom` |
| 34 | Delete saved deck | "Delete deck" + inline confirm "Delete this deck?" "Games that use it keep their cards." | DELETE `teams.pokerDecks.destroy`; `onHttpException` reload `only:['pokerDecks']`, return false | `DeckPicker.onDelete` -> built-in `ConfirmDialog` (same title and description keys) | CHANGES: `Delete deck` -> `Delete :name`; second confirm button `button:has-text("Delete deck") >> nth=1` | keep exception handler |
| 35 | Edit/delete hidden for non-managers | `deck.canManage` | policy | `Deck.canManage` | `assertDontSee('Edit deck')` | |
| 36 | Open "New whiteboard" | `NewWhiteboardDialog` trigger (only `canCreate`) | client; reload `only:['whiteboardGallery']` if undefined | `NewSessionDialog` `defaultType="whiteboard"` | `button:text-is("New whiteboard")` | reload also when switching type to whiteboard |
| 37 | Whiteboard title (required, max 120, autofocus, starts empty) | `#whiteboard-title` | client | `Input` `#whiteboard-title`, autoFocus when type = whiteboard | id | other types keep the title prefill |
| 38 | Pick a template (built-in, then "Workspace templates") | tiles `role="radio"` in `radiogroup`; SVG preview + name + description | body `template` XOR `workspace_template_id`; default `blank` | `WhiteboardTemplateGallery` (compose, section 4) with `RadioGroupCardItem` tiles, roving focus + arrows | name in `span.font-medium`, description in `span.text-muted-foreground`, preview `svg` direct in tile, 2 radiogroups (built-in / workspace), heading text "Workspace templates", exactly one `aria-checked=true` inside the gallery | CHANGES (scope): type picker also has `role=radio`/`radiogroup` — see section 8 |
| 39 | Template errors | `InputError` for `template` / `workspace_template_id` | 422 | error line under the gallery | text | |
| 40 | Gallery loading | 6 skeleton tiles | lazy | 6 `Skeleton` tiles | none | |
| 41 | Create the board | "Create" (no Cancel) | POST `teams.whiteboards.store`; redirect `whiteboards.show` | footer "Create & open" (+ Cancel, new) | CHANGES: `form button:text-is("Create")` x3 | |
| 42 | Open "Whiteboard templates" manager | `WhiteboardTemplatesDialog` trigger, always shown | client | same trigger, Dialog with rows | button text | |
| 43 | Edit a template (name max 80 required, description max 300) | inline form | PATCH `workspaces.whiteboardTemplates.update` `preserveScroll`; `onHttpException` reload `['whiteboardTemplates','whiteboardGallery']` | inline edit in row (`Input maxlength=80`, `Textarea/Input maxlength=300`), Save/Cancel | `[role="dialog"] input[maxlength="80"]`, `input[maxlength="300"]`, `form button:text-is("Save")` | keep the maxlength attributes (P17b-09..12) |
| 44 | Delete a template + confirm | inline confirm "Delete this template?" "Boards already created from it are not changed." | DELETE same | `ConfirmDialog` same keys | text | |
| 45 | Empty templates | "No whiteboard templates yet." / "Save a board as a template from its menu." | client | `EmptyState` same strings | text | |
| 46 | Edit/Delete only if `canManage` | | policy | same | `assertNotPresent` rows | |
| 47 | Open "New room" (games index) | `NewRoomDialog` trigger | client | `NewGameRoomDialog` trigger (`Plus` + "New room") | `click('New room')` | |
| 48 | Room name (max 60, required, autofocus) | `#new-room-name` | client | `NewGameRoomDialog` `ids` default | `#new-room-name` | |
| 49 | First game (available only) | Select `#new-room-game` | `game` | same Select | `#new-room-game`, `[role="option"]:has-text("Hangman")` | |
| 50 | Who can join | Select `#new-room-access` ("Team members only" / "Anyone with the link") | `access` | same | `#new-room-access` | |
| 51 | Create room | "Create room" (disabled w/o game) | POST `teams.gameRooms.store`; redirect `games.show` | `onCreate(values)` -> `form.submit`, resolves `true` on success, `false` on error (dialog stays, `errors` shown) | `click('Create room')` | |
| 52 | Cancel / Escape / focus return | Cancel | client | Radix Dialog | none | |
| 53 | Switch type inside the dialog | none (new) | client | `SessionTypePicker` tiles (`as="radiogroup"`), arrows skip disabled; per-type form state kept while open | new tests | `options` = retro, poker, whiteboard (D4) |
| 54 | Mobile | none (dialog scrolled) | client | `useIsMobile()` -> `Drawer` full height, sticky footer | 375 px: `scrollWidth <= innerWidth` | P17b-06 covers whiteboard at 375 |

## 4. Composition

New container folder: `resources/js/components/teams/session-create/` (stays in the existing `teams` domain folder; no new base folder).

| File | Role |
|---|---|
| `new-session-dialog.tsx` | `NewSessionDialog({ trigger, defaultType, team: {workspaceSlug, teamId, name}, options flags (canCreate per type), retro: {categories, catalogue, llm, icebreakerGames}, poker: {deckOptions, savedDecks}, whiteboard: {gallery} })`. `Dialog` (`DialogContent` `className="sm:max-w-244"` = 61rem, `max-h-dialog` scroll, sticky header/footer) or `Drawer` when `useIsMobile()`. Header: title "New session", description "Team :team". Body: `SessionTypePicker` (`variant="tiles"`, `label="Session type"`), then the active form. Mounted only while open (`{open && …}`) to keep fresh defaults and the lazy reloads. Owns the three `useForm` hooks (state kept when switching type). Footer: Cancel, `type="submit"` "Create & open"; `<form>` wraps body + footer so Enter submits |
| `retro-session-fields.tsx` | Left: Name `Input`; `RetroTemplatePicker` (`value`, `onValueChange`, `templates`, `categories`, `loading`, no `onUse`/`onDuplicate`, `onCreate` -> `router.visit` workspace templates when the My workspace tab is empty). Right: settings rows |
| `poker-session-fields.tsx` | Name; `DeckPicker`; inline `DeckEditor` sub-view for "Create a deck" (Cancel returns to the picker); rows for anonymous votes / auto reveal |
| `whiteboard-session-fields.tsx` | Name; `WhiteboardTemplateGallery` |
| `whiteboard-template-gallery.tsx` | COMPOSED (no component exists): `RadioGroup` (built-ins) and a second `RadioGroup` (workspace) with heading "Workspace templates"; tile = `RadioGroupCardItem` containing the preview surface (`div` direct child) + `span.font-medium` name + `span.text-muted-foreground line-clamp-2` description; auto-fill grid `minmax(min(100%, --spacing(40)),1fr)`; `aria-label="Template"` on both groups; 6 `Skeleton` tiles while loading |
| `setting-row.tsx` | COMPOSED (`.sc-opt`): `grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-2`; label (`Label htmlFor`), help line, control slot (`Switch`, stepper, `Select`). Children indented under a switch (icebreaker game) |
| `lib/retro/template-adapter.ts` | `toRetroTemplate(item: CatalogueTemplate): RetroTemplate`, `defaultTemplateKey(catalogue)`; Vitest |
| `lib/poker/deck-adapter.ts` | `toDeck(option: PokerDeckOption)`, `toSavedDeck(saved: SavedPokerDeck)` (via `deckShapeFromCards`), `customDeckToPayload(draft)` -> body, `serverErrorsToDeckErrors(errors)`; Vitest |
| `saved-decks-dialog.tsx` (rewrite) | `Dialog` + `DeckPicker` + `DeckEditor` + `ConfirmDialog` (DeckPicker owns the delete confirm), `router.post/patch/delete` as today |
| `whiteboard-templates-dialog.tsx` (rewrite) | `Dialog`, list rows with `Button` Edit/Delete, inline edit form, `ConfirmDialog` |
| `whiteboard-template-preview.tsx` (rewrite) | same geometry, tokenized surface (see D5), no hex literal except via a named constant for scene text bars |
| `components/games/new-room-dialog.tsx` (rewrite) | `NewRoomDialog({workspaceSlug, teamId, gameOptions})`: `useForm<{name,game,access}>`; `onCreate = (values) => new Promise(resolve => form.transform(() => values).submit(TeamGameRoomsController.store({workspace, team}), { onSuccess: () => resolve(true), onError: () => resolve(false) }))`; passes `errors={form.errors}`, `processing`. Renders skrum `NewGameRoomDialog` |

Adapters, field by field:

| Server shape | Component prop |
|---|---|
| `CatalogueTemplate.key` | `RetroTemplate.id` |
| `.name`, `.category` | same |
| `.isWorkspace` | `source: 'workspace'` else `'builtin'` |
| `.isCommon` | sort key only (common first); no section any more |
| `.columns[]` `{title, description, color}` | `columns[]` `{title, color, description}`; server colours accepted by `columnColorClass` (green->moss...) |
| (none) | `description`, `defaults`, `isTeamDefault`, `usageCount`, `workspaceName` left undefined; no `recent` templates so no Recent tab |
| `PokerDeckOption` (`value,label,cards`), `value !== 'custom'` | `Deck {id: value, name: label, source:'builtin', ...deckShapeFromCards(cards)}` (the server `custom` option is dropped: replaced by "Create a deck") |
| `SavedPokerDeck` (`id,name,cards,canManage`) | `Deck {id, name, source:'saved', canManage, ...deckShapeFromCards(cards)}` |
| deck selection | builtin -> `{deck: id}`; saved -> `{deck:'custom', saved_deck_id: id}`; one-off -> `{deck:'custom', custom_cards, include_unknown, include_coffee, save_deck_as?}` (same as `deckPayload`) |
| `WhiteboardGalleryItem` | tile: id = `key`; selecting sets `template` (`workspaceTemplateId === null`) or `workspace_template_id`, other null (same as `select()` today) |
| `useForm.errors` `custom_cards`, `custom_cards.N` | `DeckEditor.errors.values`; `save_deck_as` -> `errors.name`; `deck`, `saved_deck_id` -> error line under the picker |

Reused as they are: `useTrans`, `useIsMobile` (`hooks/use-mobile.tsx`, 768 px), `useShortcut`, Wayfinder controllers listed in section 1, `lib/retro/api` (none here), `splitCustomCards`/`deckPayload` (from `deck-fields.tsx`, kept).

`skrum/` and `ui/` used: `SessionTypePicker`, `RetroTemplatePicker`, `DeckPicker`, `DeckEditor`, `ConfirmDialog`, `EmptyState`, `NewGameRoomDialog`; `ui/dialog`, `drawer`, `input`, `label`, `switch`, `select`, `radio-group` (`RadioGroupCardItem`), `skeleton`, `button`, `badge`, `tabs` (inside picker).

Interface changes proposed on existing components (small, aligned to back end): (a) `Deck.source` gains `'custom'` with badge "This game only" for the one-off deck (D3); (b) none else expected. `SessionTypePicker` already accepts `options`, `label`, `disabledReason`; its type is `'survey'` not README's `'poll'`, irrelevant here.

## 5. Realtime

None for creation. `DeckPicker` README mentions `DeckSaved` / `DeckDeleted` on `private-team.{teamId}`: these events do NOT exist in the back end (`grep` over app/, resources/js, routes found nothing), so the saved-decks grid refreshes only through Inertia reloads as today (`router.reload({only:['pokerDecks']})` after exceptions). The `private-team` channel is not used. Two-browser check to keep: a deck deleted in browser B, then browser A creating a game with that `saved_deck_id`, must reload and not crash (existing `onHttpException` path, row 34).

## 6. Mockup elements not rendered / without mockup

Not rendered (spec §10 or no back end; verified against the three store validators):

| Mockup element | Why |
|---|---|
| Sessions page behind the dialog, "Search sessions", "Schedule…", "Upcoming/Live/Finished" | Sessions index in backlog |
| Poll tile | no standalone survey (surveys live inside a retro) |
| Icebreaker tile | rooms need `gameOptions` and `canCreateGameRoom`, which `TeamsController@show` does not send (§9 does not list them); rooms stay created from `games/index` (row 47-51) |
| Editable columns in the preview (add column, rename, reorder, 8-colour palette per column) | `teams.retros.store` takes only `template` (a key); "per-retro column edit" not in spec §9. The mini-board is read-only |
| "Browse" button and the 5 shortcut cards | replaced by the full picker inline (D3) |
| Votes "Max per card" | no server field (grep `votes_per_card` in app/: none) |
| "Timer per phase", per-task timer | backlog "per-phase timers"; timer is set in the session |
| "ROTI at the end" toggle | ROTI is a phase after B1; not optional |
| Invitation block (link + Copy, "Anonymous guests allowed") | not part of the store contract; the ShareDialog in the session carries it |
| "Save as team template" | no route to save a draft; templates are managed on workspace templates (group 9) |
| Poker: Tasks (Jira import / manual / later), Watch only, revote, "Write estimates to Jira", info note | not accepted by `teams.pokerGames.store`; backlog "Jira JQL import" |
| Redirect text "invitation link is created right away" | no equivalent; header says "Team :team" only |

Without mockup, designed from neighbours: whiteboard form (tiles like `DeckPicker` cards, Name like the other two types, previews from the existing SVG renderer); the `Anonymous votes` poker row; the AI-summary retro row; Saved decks manager (DeckPicker + DeckEditor in a Dialog, per DeckPicker README "page Saved decks"); Whiteboard templates manager (same pattern as Saved decks, rows + inline edit + ConfirmDialog).

## 7. Back-end changes

None listed in spec §9 for this group. Gaps to report, not plan: (1) `DeckSaved`/`DeckDeleted` broadcasts (DeckPicker README); (2) usage count, team default template, recent templates, template descriptions and defaults for `RetroTemplatePicker` (adapter leaves them out, README says "preselect team default, else last used": falls back to first built-in); (3) `gameOptions` / `canCreateGameRoom` on `teams/show` if the Icebreaker tile is wanted; (4) per-retro column overrides at creation.

## 8. Browser tests

Files that bind to this group and what changes. "Dialog scope" fix: add the template gallery/picker container to selectors, since the type picker adds 3 `role=radio` and 1 `radiogroup` to every dialog.

| File | Binds to | Must change (mockup cause) |
|---|---|---|
| `Plan04RetroCoreTest.php` (79-90) | `New retrospective`, `#new-retro-title`, `[role="dialog"] li button…`, `li button[aria-pressed="true"]`, `button[type="submit"]` | `li button` -> `[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]`; `aria-pressed` -> `aria-checked` (RetroTemplatePicker README) |
| `Plan08aFlowAndTemplatesTest.php` P08a-01a (160-215), 01b (220-250), 03 (350-375) | `li button` x53/54, `aria-pressed`, `h3 Preview`, `Common templates`, `More templates`, "No templates match your search.", "Empty board", swatch classes `bg-emerald-500…`, Settings button, `#new-retro-*` | rewrite selectors to `[role="radio"]` inside "Retrospective template"; counts now exclude "Start from scratch" (52 + blank card; 53 built-in+custom today -> recount); preview = `section[aria-label="Template preview"]`, mini-board items instead of `li`; swatch assertion -> `bg-skrum-col-moss`, `…-coral`, `…-sun`, `…-sky` equivalents; remove Common/More assertions; no-match text -> `No template matches "…"`; `Empty board` -> "Start from scratch"; delete the Settings click; "Workspace templates" -> click tab "My workspace" first |
| `Plan08bHealthCheckTest.php` (250-260) | `li button[aria-pressed="true"]` count 1, Settings click, `#new-retro-health-check` | `[role="radio"][aria-checked="true"]` count 1 scoped to the picker; drop Settings click |
| `Plan08eLlmTest.php` (126-131, 252-262, 701-710) | `[data-slot="collapsible-trigger"]`, `li button:has-text`, `#new-retro-ai-summary`, `#new-retro-votes-auto` | drop the collapsible click; template selector as above |
| `Plan13dIcebreakerScoresInvitesTest.php` (172-196) | Settings click, `#new-retro-icebreaker`, `#new-retro-icebreaker-game`, option "Hangman" | drop Settings click, template selector |
| `Plan10aPokerCoreTest.php` P10a-02 (96-118), P10a-03 (136-152) | `[role="radio"]` count 5, chips `span span`, `Custom` radio, `#deck-custom-cards`, `#deck-include-*`, `Create game`, server duplicate error | count: 4 built-in decks (+0 saved) = 4 radios in "Deck" group + type picker 3: scope to `[aria-label="Deck"] [role="radio"]` count 4; chips from `DeckPicker` `PreviewValues`; open "Create a deck" button then `#deck-new-cards` (`3, 3` is refused client-side: assert "Duplicate value: 3"); `Create game` -> `Create & open` |
| `Plan10bPokerAdditionsTest.php` P10b-01 (60-100), 02a (120-160), 02b (160-190) | `New deck`, `#deck-new-*`, `Save`, chips `li span.font-mono`, `Edit deck`, `Delete deck`, `#new-poker-anonymous`, `#new-poker-auto-reveal`, `Create game` | "New deck" -> "Create a deck"; chip selector -> DeckPicker preview values; "Edit deck"/"Delete deck" -> `Edit :name` / `Delete :name`; `Create game` -> `Create & open`; ids `#new-poker-*` unchanged |
| `Plan17aWhiteboardCoreTest.php` P17a-01 (38-42) | `#whiteboard-title`, `[role="radio"][aria-checked="true"]`, `form button:text-is("Create")` | scope the checked radio to `[aria-label="Template"]`; button text -> "Create & open" |
| `Plan17bWhiteboardTemplatesTest.php` P17b-03 (258-285), -05/-06 (440-465), -07 (480-500), -08 (530-535), -12 (700-715), -15 (810-822) and `p17bCreateBoard()` | `[role="radiogroup"]` presence/counts (1, 2), `[role="radio"]` counts 8/9, `span.font-medium` names, `span.text-muted-foreground`, `svg`, `[role="radio"] > div` white surface, `form button:text-is("Create")` | scope all counts to `[role="dialog"] [aria-label="Template"]`; `p17bCreateBoard` default `$createLabel='Create & open'`; P17b-07 white surface: see D5 |
| `Plan13aGamesFoundationTest.php` (92-103) | `New room`, `#new-room-*`, `Create room` | none |

Selectors that survive: `#new-retro-title`, `#new-retro-*` switch ids with `aria-checked`, `#new-retro-icebreaker-game`, `button[type="submit"]`, `#new-poker-title`, `#new-poker-anonymous`, `#new-poker-auto-reveal`, `#whiteboard-title`, `#new-room-*`, `[aria-label="Search templates"]`, `[aria-label="Category"] button`.

New tests (`tests/Browser/Walkthroughs/Plan18eSessionCreateTest.php`):

| ID | Test |
|---|---|
| P18e1-01 | type picker: three tiles, arrows move selection, each type keeps its own title and settings when switching and returning |
| P18e1-02 | retro: My workspace tab lists the workspace template (replaces "Workspace templates" section assertion), selecting and creating sends `workspace:{id}` key |
| P18e1-03 | retro: Enter in the Name field submits ("Create & open") |
| P18e1-04 | poker: "Create a deck" with a name creates the game and a saved deck (`save_deck_as`); without a name creates a one-off deck |
| P18e1-05 | whiteboard gallery: keyboard (arrows) picks a template; workspace template tile selection nulls `template` |
| P18e1-06 | mobile 375 px: the dialog is a full-height Drawer, no horizontal scroll, sticky footer reachable, retro created |
| P18e1-07 | saved decks dialog: manager sees Edit/Delete, other member does not (replaces assertions in P10b-01) |
| P18e1-08 | dark theme and FR: no overflow (visual test `SessionCreateVisualTest`, 1440 and 390, light/dark, FR/EN) |
Vitest: `template-adapter.test.ts`, `deck-adapter.test.ts` (payload shapes, error mapping), `new-session-dialog.test.tsx` (type switch keeps state, submit target per type).

## 9. Risks and open questions

| Risk | Evidence |
|---|---|
| Type picker adds `role=radio` and `radiogroup` to every creation dialog; tests count radios (5, 8, 9, 1, 2) | `Plan10aPokerCoreTest.php:104`, `Plan17bWhiteboardTemplatesTest.php:265-272,449,482,820` |
| Template counts (53/54) and sections change; the "Custom"/blank card moves out of the list | `Plan08aFlowAndTemplatesTest.php:180,200,361`; picker `templates.filter(id !== blankId)` in `retro-template-picker.tsx:640` |
| Picker detail panel has a `Use this template` button only if `onUse` is passed; with none, selection must be enough. If both `onUse` and submit exist, two ways to continue | `retro-template-picker.tsx:540` |
| Two instances of `DeckEditor` / `NewGameRoomDialog` need distinct ids: poker dialog editor (`deck-new`) and Saved decks dialog can both be mounted if the page keeps both dialogs open states; they are separate dialogs so only one mounts, but keep `{open && …}` | notes-for-18e "fixed default ids" |
| Escape inside picker search / DeckEditor chip must not close the dialog: both components already claim Escape (`retro-template-picker.tsx` window listener, `deck-editor.tsx`); verify nested in the new dialog | notes-for-18e |
| Whiteboard preview surface is white in dark mode on purpose (scene colours are canvas data); `bg-white` and `#ced4da` violate rule 1 | `whiteboard-template-preview.tsx:3,37`; app.css has `--skrum-canvas` oklch(0.965…), not pure white |
| `DeckPicker` has no "custom" source; showing a one-off deck as "Saved" or "Built-in" would be wrong | `deck-picker.tsx:17-26` |
| Shared helpers must survive until groups 2, 3, 9 delete them | section 1 |
| Both group 1 and group 4 edit `poker-games-section.tsx`, `whiteboards-section.tsx`, `pages/teams/show.tsx` | section 1; run sequentially |
| `TranslationKeysTest` scans literal `t('…')`; ~25 new keys in 4 languages (FR +30% length: footer, setting rows must truncate, not wrap) | spec rule 10 |
| DialogContent is `sm:max-w-lg` by default; 61rem needs `sm:max-w-244` and keeping `max-h-dialog`; sticky header/footer inside a scrolling `DialogContent` is not yet used anywhere (not verified that `DialogContent` supports it without a wrapper) | `ui/dialog.tsx:69` |
| Not verified: mobile `Drawer` accessible role in Pest browser (vaul renders `role=dialog`; existing tests use `[role="dialog"]`); `Switch` `aria-checked` attribute exposure through `assertAttribute` (Radix sets `aria-checked`); `RetroTemplatePicker` behaviour inside a `Dialog` at 375 px; whether `useRetroSettingGroups` ids could be reused (they are `retro-*`, tests need `new-retro-*`, so not reused) |

Decisions needed (product owner):

| # | Question | Recommendation |
|---|---|---|
| D1 | Footer label: mockup says "Create & open" for all types; today "Start" (retro), "Create game", "Create" | Adopt "Create & open" (retro tests use `button[type="submit"]`, so only 3 poker and 3 whiteboard clicks change) |
| D2 | Entry points: keep the three triggers ("New retrospective", "New game", "New whiteboard") in their sections, or one "New session" button (mockup, from a Sessions page that does not exist) | Keep three triggers now, each preselects its type; `NewSessionDialog` is controlled-capable so groups 4 and 12 can add a global "New session" (`SessionTypePicker as="menu"`) later with no rewrite |
| D3 | Template choice: full `RetroTemplatePicker` inline in the dialog (search, categories, tabs, detail with mini-board), or mockup's 5 shortcut cards + "Browse" | Inline picker: no 5-shortcut data source (no usage or default info on the server), keeps search and category hooks |
| D4 | Types offered: 3 (retro, poker, whiteboard) or the mockup's 5 (Poll, Icebreaker) | 3; Icebreaker would need two new `teams/show` props (back-end change outside §9) |
| D5 | One-off custom deck badge and whiteboard preview surface: add `Deck.source: 'custom'` ("This game only"); add a `@theme` token for the always-light preview paper (value pure white so P17b-07 keeps `rgb(255,255,255)`) | Both additions; otherwise P17b-07 must be relaxed |

## 10. Size

| Measure | Count |
|---|---|
| Containers/files to write | 11 (`new-session-dialog`, 3 `*-session-fields`, gallery, `setting-row`, 2 lib adapters, plus rewrites of `saved-decks-dialog`, `whiteboard-templates-dialog`, `whiteboard-template-preview`, `new-room-dialog`) |
| Old files deleted | 3 (`new-retro-dialog`, `new-poker-game-dialog`, `new-whiteboard-dialog`); 4 rewritten in place; 0 shared helpers deleted |
| Tests touched | 9 browser files edited (Plan04, 08a, 08b, 08e, 13d, 10a, 10b, 17a, 17b), 1 new browser file, 1 visual test, 3 Vitest files |
| Parity rows | 54 |
| Commits | 4 |

Parallelism: can run alongside groups 2, 3, 5, 6, 7, 8 (disjoint files). Shared files: `pages/teams/show.tsx`, `poker-games-section.tsx`, `whiteboards-section.tsx` (group 4: run after), `lang/{en,fr,es,de}.json` (additive keys; merge conflicts only), `resources/css/app.css` (one `@theme` token, D5), `components/skrum/deck-picker.tsx` (D5, if accepted; group 3 also uses DeckPicker for game settings: coordinate), `types/` (none expected). Does not touch `app.tsx` layout switch.
