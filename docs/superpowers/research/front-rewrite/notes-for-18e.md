# Notes for plan 18e (from the back-end-fit review at abd4938)

Features with no dedicated component, to be composed from primitives in each screen's commit:
- Retro: card composer (RetroCard `editing` + `editorTools`), add-column form, comment threads (card, survey, action item), survey builder and AI draft, suggestions panel, action-item create form and sub-task checklist, export dialog, carried-items sheet, presentation overlay, results view (participants, summary, top topics, games played, radar and trend via HealthCheckResults `children`), recap share and e-mail dialogs, delivery lines (ShareDialog `channelsExtra`), hand-over and delete dialogs, vote progress bar, unread-comment dot (RetroCard `footer`), session-expired banner, BoardEnded.
- Poker: task queue (dnd-kit, `data-test="poker-task-row"`), task form, import dialog, source details, estimate conflict, round history, spectator toggle and "You're watching" strip, empty table states (PokerTable requires `story`).
- Games: hangman, draw canvas and toolbar, decoded clue editor, GIF stages, guess chat, round end card, history drawer, room menu and settings, RoomFull, RoomGone.
- Whiteboard: status bar, board menu, save-template dialog, sticky tool trigger in the Excalidraw toolbar, scene export, new-whiteboard gallery with SVG previews, whiteboard templates dialog.
- Team, workspace, settings: members tables, invitations, API tokens, 2FA and passkeys, every integration card and panel, estimates history table.
- No data source: MoodTrendChart on the team page (no team-level trend prop; `healthTrend` exists only in a completed retro's results) — add a back-end item to the spec or omit the chart there.
- Navigation: `workspaces/members` has no entry in the sidebar model; link it from `workspaces/show`.
- Adapters to write: `content`→`title`, `assignee`→`owner`, `dueOn`→`dueDate`; RotiResults `average`/`respondents`/`distribution[]` → widget props; a poker spectator who voted before a non-anonymous reveal → seat state `voted`; ROTI "click the selected score again" → DELETE.
- Kept libraries: dnd-kit (refs and rest props forwarded), frimousse (picker slots), live-reactions (`.whiteboard-reactions` class kept through rest props), live-cursors (the library keeps drawing `.lc-overlay`; `skrum/live-cursor.tsx` is a separate layer — decide per screen; 38 `.lc-overlay` assertions), Excalidraw (toolbar-slot injection, `data-facilitator`, DOM adjustments stay in container code and CSS).
- Shared prop collision: page props named `teams` on settings/api-tokens and action-items/index must be renamed when those screens are rewritten.
- Sonner accessible labels: `<Toaster />` in app.tsx is outside the page context; pass translated `containerAriaLabel` / `closeButtonAriaLabel` from a layout.
- Table mobile list form: the Actions screen uses the ActionItem list on mobile.
- Controlled Sheet/Drawer without a trigger: pass `onCloseAutoFocus={useRestoreFocus(open)}`.
- HealthCheckResults and ROTIWidget show results for any respondent count by default (server has no threshold).
- Group markup changed: the group is a section around its cards, not inside the lead card; old selectors such as `#card-{lead} [aria-label="Rename group"]` will not match — tests of grouping need their selector updated in the retro screen commit (mockup-imposed structure: CardGroup README).
- Health statements reorder handle keeps the exact name "Drag to reorder" (browser suite); rows are distinguished by `aria-describedby`.

## Component interfaces changed during review

Condensed from the two fix passes of plan 18b+18c. "old → new" where a prop changed, "+" for an addition. Defaults named here are the ones the browser suite binds to.

### Primitives (`components/ui`)
- `DialogContent`: + `size?: 'default' | 'sm'` (default 32rem as before the retheme; `sm` = 27.5rem, used by ConfirmDialog, FormDialog, NewGameRoomDialog). `closeLabel` defaults to `t('Close')`. `DialogHeader` reserves room for the close button.
- `SheetContent`, `DrawerContent`: `closeLabel` defaults to `t('Close')`. A controlled sheet or drawer without a trigger passes `onCloseAutoFocus={useRestoreFocus(open)}` (`@/components/ui/use-restore-focus`).
- `DropdownMenuContent`, `DropdownMenuSubContent`: + `size?: 'default' | 'wide'` (default 8rem minimum as before; `wide` = 13.75rem), `collisionPadding` default 8. `DropdownMenuContent`: + `portalled?: boolean`. `DropdownMenuLabel`: + `variant?: 'default' | 'overline'`. Rows grow with two-line content.
- `CardMenu`: + `defaultOpen?`, `inline?`. New export `DropdownMenuInlineFrame`.
- `PopoverContent`: `collisionPadding` default 8.
- `SelectTrigger`: the value truncates with an ellipsis for every caller; an icon inside the value is inline. `SelectItem` text truncates.
- `TableSortHead`: the label keeps its width in an auto table and truncates when its column is constrained.
- `Badge`: + `linkIcon?: boolean` (the arrow of an `asChild` badge is opt-in); the height grows with a wrapping label.
- `CommandDialog`: `title` / `description` defaults are translated.
- `InputOTP`: default `pasteTransformer`. `ResendCode`: the button is always rendered.
- `Breadcrumb`: landmark name and ellipsis text are translated ("Breadcrumb", "Show full path").
- Sonner labels stay English until a layout passes translated props.

### `useShortcut` (`hooks/use-shortcut.ts`)
- `combo: string` → `string | string[]`.
- Options: + `scope?: RefObject<Element | null>`, + `enableInOverlays?: boolean`. With `scope`, an open dialog, menu or listbox silences the shortcut unless it contains the scope element. Every page-level shortcut passes `scope`; only a shortcut enabled by its own overlay opening omits it.
- Events with `defaultPrevented` are ignored: a local handler that owns a key calls `preventDefault()`. New export `overlaysOfEvent(event)`.

### Retro
- `RetroCard`: `text: string` → `string | null`; `color` accepts design and server colours; `author` → `{ id, name, avatarUrl?, presence? }`. + `gif`, `onGifOpen`, `isMine`, `insight`, `commentCount`, `commentsOpen`, `onOpenComments`, `onFocusToggle`, `menuEntries`, `footer`, `editorTools`, `children`, `ref`, every `<article>` prop. + `domId?` (the article has `id="card-{id}"` by default), `reactionPicker?`, `onOpenReactionPicker?`, `RetroCardReaction.names?`, `labels?: { vote?, voteBlocked? }`. The vote button is named "Add a vote" and carries the native `disabled` attribute when `canVote` is false; `labels.voteBlocked` is read next to it and shown from a focusable wrapper. "Remove a vote" is rendered only when the viewer has a vote and can vote.
- `CardVotes` (`vote-dots.tsx`): the button is named "Add a vote", natively `disabled` when blocked, with the reason next to it; the total is read as ":count vote(s)".
- `CardGroup`: + `domId?` (no default: the group is a section around its cards), `titleHint?`, `titleMaxLength` (60), every `<section>` prop. No ungroup button on the first card. Names: "Rename group", "Group name", "Ungroup"; an unnamed editable group reads "Name this group". Authors of masked cards are not shown when collapsed.
- `RetroColumn`: `description?: string` → `string | null`; `onSort(by)` → `sortedByVotes` + `onSortByVotesChange(sorted)`; + `colorOptions`, `onDescriptionChange`, `onMove`, `canMoveLeft`, `canMoveRight`, `onDelete`, `editDisabledReason`, `titleMaxLength` (100), `descriptionMaxLength` (200), `headerAction`, `notice`, `footer`, `defaultMenuOpen`, `ref`, every `<section>` prop. Menu name "Column menu".
- `SurveyQuestion`: `results` also renders in answer mode when given and not hidden.
- `ROTIWidget`: + `minimumRespondents?` (default 0), `labels?: { question? }` (default "How was this retro?"); `ROTIResult.mean: number | null`; export `rotiMinimumRespondents` removed.
- `RetroTemplatePicker`: + `blankId?` (default `'custom'`; `BlankTemplateId` `'blank'` → `'custom'`), + `shortcuts?: boolean` (default true; `/` focuses the search, scoped to the picker).
- `TemplateEditor`: + `ids?: { name?, source?, category? }` (defaults `template-name`, `template-source`, `template-category`), `categories?`, `colors?`, `startFrom?`, `onStartFrom?`. `TemplateDraft`: `visibility`, `defaults` optional; + `category?`; column `help` → `description?: string | null`. `TemplateEditorErrors` → `Record<string, string | undefined>`. `MaxTemplateColumns` 8 → 10.
- `ColumnColorPicker`: generic over the colour type; + `colors?`. New exports `ColumnColorOptions`, `serverColumnColors`, `AnyColumnColor`.
- `SessionCard`: + `statusLabel?`, `meta?`, `action?` (outside the link).
- `SessionSettingsPopover` / `SessionSettingsContent`: + required `groups: SessionSettingGroup[]`; `value` is generic (`Record<string, boolean | number | string | null>`); `phase?: RetroPhase | string`, + `phaseLabels?`; `onAddSurvey?: () => void`; + `title?`, `errors?`, `children?`, `anchorRef?`. Removed `surveys`, `attachedSurvey`, `SurveyChoice`, `SessionSettings`. New export `useRetroSettingGroups`.
- `PhaseStepper`: + `endedLabel?` (default "Completed", with `aria-current="step"`). Without `compact` / `mobile` it follows its container (below 36rem: "Phase n/total" and a progress bar; 36 to 56rem: markers and the active label; from 56rem: the full rail), so its parent must give it a width (`min-w-0 flex-1` or `w-full`); the `phases` slot of `SessionFrame` and the `stepper` slot of the onboarding frame do. List name "Phases". One Previous and one forward button (Next, Complete, Reopen) that use `aria-disabled`.
- `FacilitatorBar`: + `label?` (default "Facilitation tools"). In compact mode destructive actions go to the More menu.
- `Timer`: + `presets?`, `onCustom?`; one pause/resume button (`data-slot="timer-toggle"`).

### Health check
- `HealthCheckForm`: statement `id` → `key`; + `myScore?`, `count?`, `answeredBy?`; `answers` optional and keyed by `key`; `onSubmit` optional; + `scale?` (10), `onClear?`, `disabled?`.
- `HealthCheckResults`: result `statementId` → `key`, `mean` → `average: number | null`, `previousMean` → `previousAverage`, `distribution` optional `number[]`; + `scale?`, `minimumRespondents?`, `summary?`, `children?`.
- `HealthStatementsManager`: statement → `{ id, key?, label, text, isBuiltin, isArchived }`; `onToggle`, `onDelete` removed; + `onArchive?`, `onRestore?`, `addErrors?`, `editErrors?`, `error?`, `defaultArchivedOpen?`. The reorder handle is named "Drag to reorder".

### Poker
- `PokerTable`: seat `user` → `PokerSeatUser { id, name, avatarUrl?, presence?, isMe? }`; seat `state` + `'watching'`, `value?: string | null`, + `offline?`. `PokerResult` → server shape `{ average, distribution, mode: string[], consensus, nearestCard }` + optional `median?`, `agreement?`, `outliers?`; `result?: PokerResult | null`. + `anonymous?`, `revealReason?`, `facilitatorId?`, `locale?`, `seatMenu?`, `votingTools?`, `busy?`, `estimate?`, `estimateValues?`, `isNumeric?`, `nextDisabled?`, `shortcuts?`, `tableLabel?` (seats region `<section aria-label="Players">`). `onAccept(value)` receives the chosen estimate. Seat cards are `role="img"` named "Bob: Voted" / "Bob: Not voted yet" / "Bob: 5" / "Bob: Absent". Focus moves to the result on reveal.
- `PokerResultPanel`: `seats` optional; + `sectionRef?`.
- `PokerDeck`: + `selection?: 'toggle' | 'radio'` (default `toggle`: buttons named "Play :card" with `aria-pressed`; pressing the selected card retracts). `PokerCard`: `label` overrides the name in every state.
- `DeckPicker`: + `onDelete?`; `Deck.canManage?`. `DeckEditor`: + `nameRequired?`, `saveLabel?`, `idPrefix?` (default `deck-new` → `#deck-new-name`, `#deck-new-cards`, `#deck-new-unknown`, `#deck-new-coffee`); the add field accepts a comma list. `DeckMaxValueLength` 4 → 8.
- `VoteDrawer`: + `container?`; new export `VoteDrawerPanel`. `ReactionDrawer`: + `container?`; new export `ReactionDrawerGrid`.
- New `ReactionPicker` `{ trigger, emojis, mine, onToggle, side?, align?, open?, defaultOpen?, onOpenChange?, label?, className? }` and `ReactionPickerGrid`; fits ReactionBar's `picker` slot.
- New `PokerRounds` `{ rounds, players?, count?, status?: 'ready' | 'loading' | 'failed', isNumeric?, locale?, open?, defaultOpen?, onOpenChange? }` (server `PokerRound` type).
- `ReactionBar`: digits 1 to 6 go through `useShortcut` scoped to the toolbar.

### Action items
- `ActionItem`: `id` is the DOM id (rest props; `data-id` no longer emitted). `ticket` → `links?: ActionItemLink[] | null`. `source` → `{ label, url?, retroId? } | null`. `owner` + `kind?`, `isTeamMember?`. Status button names "Mark as done" / "Reopen" / "Mark as in progress". + `overdue`, `completedVia`, `createdBy`, `themeName`, `teamName`, `recurrence`, `followUpDate`, `subtasks`, `commentCount`, `commentsOpen`, `comments`, `children`, `actions`, `meta`, `showOwnerName`, `canComplete`, `busy`, `titleMaxLength`, `onDelete`, `onRetrySync`, `onToggleComments`.
- New `ActionSheet`: `ActionItemData` plus `open`, `onOpenChange`, `side`, `readOnly`, `canComplete`, `savingField`, `deleted`, `titleMaxLength`, `watchers` and the slots `children`, `comments`, `originCard`, `history`, `actions`.

### Sharing, joining, presence and others
- `SessionFrame`: `sidebar: AppSidebarProps` → optional; without it there is no sidebar and no trigger. `SessionLayout` passes none for a guest.
- `GuestJoin`: `onSubmit(data)` → `onSubmit(data, formData)`; + `children` (between the nickname and the button, e.g. `#spectator`). Session kind `'survey'` removed, `'game'` added; `code`, `status`, `participants`, `facilitator` optional; + `gameLabel?`.
- `ConfirmDialog`, `FormDialog`: + `error?: string`; `FormDialog`: + `tone?: 'default' | 'destructive'`.
- `ShareDialog`: new export `ShareDialogContent` (body without the overlay). "Send n invitations" uses `aria-disabled`.
- `KeyboardShortcuts`: new export `KeyboardShortcutsPanel`.
- `ConnectionState`: status + `'expired'`, + `onReload`. `EditingIndicator.user`: + `avatarUrl`.
- `PresenceStack`: root is `role="group"` named ":count online"; + `labels?: { group?, trigger? }`; participant + `avatarUrl?`, `initials` and `presence` optional.
- `NotificationsPanel`: `AppNotification` is a union `ActionItemNotification | BacklogNotification` (kinds `overdue`, `due_soon`; `wording` + `actionItem`); `onInvite`, `onJoin` optional; + `failed?`, `onRetry?`, `markingAllRead?`. "Mark all as read" uses `aria-disabled`.
- `NewGameRoomDialog`: + `ids?` (defaults `new-room-name`, `new-room-game`, `new-room-access`; the room settings dialog uses `room-name` / `room-access`).
- `TextareaField`: with `onCancel`, Escape is claimed while the field has focus so a host overlay stays open; new export `claimEscape(event)`.
- `Combobox`: the popover is named after the field label.
- `GifPicker`: `GifItem` needs `previewUrl`; other media fields optional; status + `'rate_limited'`.
- `IcebreakerGameCard`: `pitch`, `color`, `durationMin`, `players`, `participants` optional; + `available?`, `unavailableReason?`.
- `MoodTrendChart`: `MoodPoint` `q1`, `q3`, `voters` optional, + `id?`, `href?`, `note?`; `team` optional; + `title?`, `metricLabel?`, `scale?`, `period?`, `deltaSincePrevious?`, `noteLegend?`, `emptyLabel?`.
- `DatePicker`: new exports `DateRangeFilter`, `DateRangeValue`, `DateRangePreset`, `formatShortRange`.

### Bench
- `BenchOverlayStage` (`components/dev/bench.tsx`) holds the one real open overlay of a section: last, one viewport tall, kept in view, so a full-page capture shows every other state.

### From the final fix round
- `PokerTable`: `section[aria-label="Players"]` now also contains the story title and the "n of m voted" text. `Plan10aPokerCoreTest` asserts that this section shows no "5" / "8" before the reveal: watch task titles (a key such as `ATLAS-58`) and counts ("5 of 8 voted") when the poker screen is rebuilt.
- `PokerTable`: Re-vote, Save estimate and Next task stay focusable while `busy` (`aria-disabled`, presses ignored); native `disabled` only for "no estimate" and `nextDisabled`. The `N` and `mod+Enter` shortcuts are scoped to the actions group.
- `PokerDeck` with `selection="toggle"`: the digit of the selected card calls `onRetract`, like a click on it.
- `TemplateEditor` (`ids`), `DeckEditor` (`idPrefix`) and `NewGameRoomDialog` (`ids`) use fixed default ids: two instances on one page need their own `ids` / `idPrefix`.
- `ROTIWidget` vote mode: `role="group"` named by the question with five `button[aria-pressed]` (labels "Time wasted" … "Excellent use of time"), as the old `RotiControl` and `Plan08dResultsTest` expect; no radiogroup. Arrows move the focus, 1 to 5 vote. A press on the pressed score calls `onVote` with the same value: the host decides to retract, as `RotiControl` does.
- `CardVotes` and `RetroCard`: the blocked vote wrapper is a `role="group"` named by the reason (no hidden text any more); focus moves there, or to the card, when the press spends the last vote.
- `DialogHeader` has no right padding by default (as on main); a dialog with the close button and a long title adds `pr-8` itself. `SelectItem` joins consecutive text children in one truncating span.
