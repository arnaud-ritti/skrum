# Skrüm design system — digest of `docs/design-system/components/`

Source: 94 component directories (26 shadcn primitives, 35 business, 28 `Screen*`, 5 `Mobile*`), each with `README.md` + `preview.html`, plus `_preview-bundle.css`.

**Coverage.** All 94 READMEs were read in full. Previews: for the 33 `Screen*`/`Mobile*` files I stripped `<style>`/SVG and read the extracted text, controls, icons and ARIA labels. Where a file holds EN and FR frames I read the EN frame(s) in full and only the start of the FR frame (same structure, translated). I did **not** read the CSS, did not render anything, and did not open the previews of family A / family B components (README only) — any README-vs-preview mismatch inside those 61 previews is unverified.

**Language/theme of previews.** No screen has a full dark-mode frame. `data-theme` appears only as nested samples: ScreenUserSettings (theme radio cards), ScreenSecurity (QR forced light), ShareDialog (QR), ExcalidrawTheme, Emails. EN+FR frames exist for: ScreenErrors, ScreenIcebreakerDraw, ScreenIcebreakerEmoji, ScreenIcebreakerGif, ScreenOnboarding, ScreenPokerQueue, ScreenRetroDiscussion, ScreenRetroGrouping, ScreenRetroROTI, ScreenSecurity, ScreenSessionCreate, ScreenTeam, ScreenUserSettings, ScreenWorkspace (and GifPicker). Everything else is FR only. READMEs are all in French.

Already installed (checked `package.json` / `composer.json`): `@dnd-kit/core|sortable|utilities`, `@excalidraw/excalidraw` 0.18.1, `input-otp`, `sonner`, `lucide-react`, `class-variance-authority`, `laravel-echo`, `@laravel/echo-react`, `pusher-js`; PHP `dicebear/core`, `dicebear/styles`, `laravel/fortify`, `laravel/reverb`, `laravel/socialite`, `socialiteproviders/openidconnect`. Not installed: `recharts`, `cmdk`, `vaul`, `react-day-picker`, `date-fns`, `@tanstack/react-table`, `react-hotkeys-hook`, `react-hook-form`, any QR library, `mjml`.

---

## 1. Family A — shadcn primitives

| Component | shadcn base | Variants / sizes / states required | Deviations from stock shadcn | npm dependency implied |
|---|---|---|---|---|
| Accordion (+ Collapsible) | `accordion`, `collapsible` | `single`/`multiple`; `variant: plain \| card`; item with `icon`, `summary` (current value shown when collapsed), `disabled`. Collapsible trigger with icon + label + count ("Rounds (2)"). States: closed, open, hover, focus, disabled | Data-driven `items[]` API; `card` variant with inset trigger (`m-1 rounded-md hover:bg-muted`), 28px icon tile turning primary-soft when open; `PokerRound` type for the poker rounds collapsible | Radix accordion/collapsible |
| Avatar (+ AvatarStack) | `avatar` | sizes xs20/sm24/md32/lg40/xl56; `presence 1..12`; `status online\|away`; `typing` ring + tréma; `kind member\|guest\|anonymous`; stack with `max` and "+N" | Presence-colour fallback classes `bg-skrum-presence-N`; status dot; typing ring; guest/anonymous kinds; DiceBear illustration by default (seed = user id), initials as fallback | `@dicebear/core` + `@dicebear/collection` if generated client-side (server side already has `dicebear/*` PHP) |
| Badge | `badge` (cva extended) | variants default, secondary, outline, muted, soft, success, warning, info, destructive; `shape rounded\|pill`; `icon`; `dot`; `asChild` link state | 5 extra variants (muted/soft/success/warning/info), destructive is soft not solid, `h-5.5`, pill shape, dot | — |
| Breadcrumb | `breadcrumb` + `dropdown-menu` | `maxItems` (4) with ellipsis menu; `separator chevron\|slash`; `collapseOnMobile` (back link + truncated title); home icon | Data-driven `items[]`; Inertia `<Link>` via `asChild`; mobile collapse | — |
| Button | `button` (new-york, not forked) | variants default, secondary, outline, ghost, destructive, link; sizes sm 32, default 36, lg 44, icon, icon-sm, icon-lg; states hover/active/focus/disabled/loading | `loading` + `loader: spinner \| trema` added through wrapper `@/components/skrum/loading-button`; `link` always underlined in `--skrum-primary-text`; `outline` uses `bg-card` | — |
| Card (+ SessionCard, StatCard) | `card` (+ `CardAction`) | Simple card; SessionCard (`kind retro\|poker\|whiteboard\|poll\|icebreaker`, `status live\|scheduled\|ended`, stats, people); StatCard (value, trend, sparkline `series`, context) | Mandatory container queries `@container/card` with theme sizes `--container-card-compact` 12.5rem, `-narrow` 17.5rem, `-wide` 18.75rem; `gap-0 py-0`; whole SessionCard is one link | — |
| Chart | `chart` | bar (grouped) and line; states rest, hover (band/crosshair + tooltip), current period (interrupted line), empty (EmptyState), loading (Skeleton); keyboard ←/→ between periods; "Voir les données" table | Generic `TeamChartProps<T>`; fixed order chart-1→5; accessible data table | `recharts` |
| Checkbox (+ RadioGroup, Switch) | `checkbox`, `radio-group`, `switch`, `label` | Checkbox incl. `indeterminate`; RadioGroup `variant default\|card`; Switch with `lockedReason`; label + description | Label/description built in; radio-card variant; switch locked-with-reason; spring easing | Radix |
| Command | `command` in `CommandDialog` | Groups `actions \| recent \| goto`; item with icon, meta, shortcut, keywords; states empty (recent + suggested), filtered with highlight, active, loading (tréma), no results | Global ⌘K / Ctrl K and `/`; footer with keyboard hints + result count outside cmdk; "En direct" badge on live recent sessions; 150 ms debounce for server search | `cmdk` |
| DatePicker (Calendar, DateRangePicker) | `calendar` + `popover` + `button` | modes single/range; shortcuts column (Today, Tomorrow, In 1 week, End of sprint, No date); `allowTyping` (dd/mm/yyyy + natural language); `overdue`; `error`; range presets filter chip; locale fr/en; `weekStartsOn` | Business shortcuts column (collapses to chips < 428px container), overdue trigger state, range footer "12 jours sélectionnés" + Clear/Apply | `react-day-picker` v9, `date-fns` (locales `fr`, `enUS`) |
| Dialog (+ AlertDialog) | `dialog`, `alert-dialog` | `ConfirmDialog` (`tone default\|destructive`, `consequences[]`), `FormDialog`; states open, initial focus (Cancel for destructive), field error, submitting | Wrapper APIs; consequences list; overlay `bg-skrum-scrim backdrop-blur-xs`; remote-deletion state replaces content | Radix |
| Drawer | `drawer` | `VoteDrawer` (deck radiogroup, 5-col grid), `ReactionDrawer` (6-col emoji grid); selected / special / unavailable card states; drag down to close | Poker-specific and reaction-specific wrappers; responsive pattern `useMediaQuery ? Popover/Dialog : Drawer`; closes itself on remote reveal | `vaul` |
| DropdownMenu | `dropdown-menu` | items, sub-menu, checkbox, radio, label, separator; `tone danger`; `disabledReason` shown at right; shortcuts | Data-driven `MenuEntry[]`; disabled-with-reason; realtime lock reason ("Inès écrit") | Radix |
| Input (+ Textarea) | `input`, `textarea`, `label` (+ `form`) | `TextFieldProps` (label, description, error, prefix icon, suffix); `TextareaFieldProps` (`maxLength` counter, `warnAt`); states focus, invalid, disabled, near-limit | Field wrapper with label/help/error; `bg-card`; counter; Cmd/Ctrl+Enter publishes a card | `react-hook-form` (optional, "si besoin") |
| InputOTP (+ ResendCode) | `input-otp` | 6 digits 3-3; states empty, focus, filled, error (shake), pasted (success flash), disabled/verifying, resend cooldown / available / sent | `pasted` flash, `ResendCode` countdown component, verification card | `input-otp` (installed) |
| Pagination | `pagination` + `select` | numbered, compact ("Page 3 sur 7"), `PageSizeBar` (range + rows per page 10/20/50/100), `LoadMore` (remaining, loading, end) | Inertia `<Link preserveScroll>` via `getHref`; container queries hide labels/pages; realtime "1 nouvelle action — Actualiser" banner; URL `?page=&per_page=` | — |
| Popover (+ Tooltip) | `popover`, `tooltip` | `ReactionPicker` (6×36 emoji grid, mine highlighted); Tooltip with `shortcut[]`, 4 sides, 400 ms delay | Tooltip inverted colours (`bg-foreground text-background`) + kbd; `TooltipProvider delayDuration={400}` at root | Radix |
| Select (+ Combobox) | `select`; Combobox = `popover` + `command` | Select with groups, icons, error, disabled; Combobox with search, highlight, `onCreate`, `renderOption`, empty text | Field wrapper (label/error); removed option becomes disabled rather than vanishing | Radix; `cmdk` |
| Sheet | `sheet` (`side="right"`) | `ActionSheet` (action detail: ticket, status, assignee, due, priority, watchers, origin card, history); states open, inline edit, late, saving, read-only (guest: no footer) | 420px, sticky footer, per-field autosave, full-screen < 640px | Radix dialog |
| Sidebar | `sidebar` (`collapsible="icon"`) | expanded `w-64`; collapsed icons `w-12` in sessions; mobile bottom tab bar (Accueil, Sessions, Actions, Moral, Plus → Drawer); team switcher menu; groups Équipe / Espace de travail; footer (Team settings, Administration if `canAdministrate`, user card menu) | Single sidebar model for the whole app, workspace switching only inside the team switcher; white-label logo; overdue badge; **no second sidebar** (settings use in-page `.sk-subnav`); ⌘B | — |
| Skeleton | `skeleton` | `BoardSkeleton` (columns, cardsPerColumn, status), `ListSkeleton` (rows, withAvatar, withBadge); static under reduced motion | Composite skeletons mirroring real layout; stronger blocks on muted surface; swap in one fade at first snapshot; after 8 s show connection state | — |
| Slider (+ Progress) | `slider`, `progress` | Slider single/range, value bubble, bounds, format; Progress determinate, 100% success tone, labelled, indeterminate | Label + mono value row; `animate-indeterminate`; `tone success` | Radix |
| Sonner (+ Alert) | `sonner`, `alert` | toast success/info/warning/error, action button, persistent (`duration: Infinity`, stable `id: 'ws'`); Alert `variant info\|success\|warning\|error` with action | `richColors={false}` with token classNames; Alert cva with 4 soft variants; Alt+T focuses toast region; bottom-right desktop / top mobile | `sonner` (installed) |
| Table | `table` + `checkbox`, `badge`, `dropdown-menu`, `button` | `ActionsTable`: sortable headers, row selection (Shift+click range, mixed select-all), bulk bar (done/reassign/delete), filters, pagination; states hover, selected, done, late, empty, loading | Data-table pattern; selection banner; mobile falls back to ActionItem list; realtime "2 mises à jour — Actualiser" | `@tanstack/react-table` |
| Tabs | `tabs` | `variant pill \| line`; icon, count, disabled, `fullWidth` | Data-driven `items[]`; `line` variant; count pill | Radix |
| ToggleGroup (+ Toggle) | `toggle`, `toggle-group` | Toggle `ghost\|outline`, sizes sm/default, icon-only; ToggleGroup `ghost\|outline\|toolbar\|segmented`, single/multiple, `iconOnly`, disabled-with-reason | `toolbar` and `segmented` variants; on-state uses primary-soft | Radix |

Sub-primitives referenced without their own README: `Alert` (in Sonner), `AlertDialog` (in Dialog), `Tooltip` (in Popover), `Switch`/`RadioGroup` (in Checkbox), `Progress` (in Slider), `Textarea`/`Label` (in Input), `Combobox` (in Select), `Calendar` (in DatePicker), `Collapsible` (in Accordion), `Toggle` (in ToggleGroup), plus `separator`, `scroll-area`, `kbd`, `form` which are only named in mappings.

---

## 2. Family B — business components

### ActionItem
- **Props:** `id, title, status (todo|doing|done), priority (low|medium|high), dueDate, doneAt, owner{id,name,initials,presence}, source{retroId,label}, ticket{provider jira|linear, key, url}, editing, onStatusChange, onChange, onLinkTicket`.
- **States:** todo / doing / done (struck), 3 priorities, due, late (text + badge), no owner ("+" guest avatar), no ticket ("Lier un ticket"), inline edit.
- **Keyboard:** Space advances status, Enter edits, ⌘/Ctrl+Enter saves, Esc cancels.
- **Realtime:** `ActionCreated`/`ActionUpdated` on `presence-retro.{sessionId}` then `private-team.{teamId}.actions`; Jira/Linear webhook → job → `ActionUpdated {status}` (ticket status wins); soft edit lock.
- **Composes:** Badge, Select, Popover+Calendar, Command (ticket search), Input, Button. Own container `@container/action`, stacks ≤ 480px (`--container-action-stack` 30rem).
- **Backend:** action status `doing`, priority, due date, `doneAt`, source, ticket link; ticket search; automatic reminder for unowned actions.

### AvatarStylePicker (+ SkrumAvatar)
- **Props:** `value: AvatarStyle, onChange, styles?, sampleSeeds[], allowMemberChoice, onAllowMemberChoiceChange, locked`; `SkrumAvatarProps {seed, style, presence, initials, size, label}`.
- **States:** tile default/hover/focus/selected; grid locked (member view when admin imposes style); live preview.
- **Keyboard:** radiogroup, arrows, Space.
- **Deps:** `@dicebear/core` + `@dicebear/collection` (client) or server-side PHP generation / Node sidecar; hosted `api.dicebear.com` is an admin option off by default. 31 styles with licence table; default recommended `notionists`.
- **Backend:** instance setting `avatar_style` + `allow_member_choice`; per-user style; SVG cache keyed `style+seed+version`; seed = user ULID (guest = pseudo + session id); CC BY attribution auto-added to an instance "À propos / Licences" page; admin toggle for hosted API.

### CardGroup
- **Props:** `id, title, color, cards: RetroCardProps[], collapsed, editingTitle, votes{total|null, mine}, canEdit, onToggle, onRename, onUngroup`.
- **States:** expanded, collapsed stack, title editing, drop target.
- **Keyboard:** Enter edits/validates title, Esc cancels; Space selects a card then `G` on target groups.
- **Realtime:** `GroupCreated`, `GroupUpdated`, `GroupDissolved` on `presence-retro.{id}`; whisper `client-group.editing`; collapse is local except facilitator focus.
- **Composes:** RetroCard, VoteDots.

### ConnectionState (+ EditingIndicator)
- **Props:** `status (connected|connecting|reconnecting|offline|resynced), attempt, maxAttempts, pendingChanges, variant (pill|banner|overlay), onRetry`; `EditingIndicator {user, target card|group|column}`.
- **States:** lost (after 5 s), reconnecting n/5, reconnected (3 s), someone editing, long-outage banner (> 30 s), read-only overlay during resync.
- **Realtime:** Echo/pusher `state_change`; backoff 1→16 s; replay local queue (idempotent by `clientMutationId`) then `router.reload({only:['board']})`; whisper `client-card.editing` (5 s expiry).
- **Backend:** idempotent mutations keyed by `clientMutationId`; `board` partial prop.

### DeckPicker (+ DeckEditor)
- **Props:** `Deck {id, name, values[2..20, ≤4 chars], unknownCard, breakCard, source builtin|saved, createdBy}`; picker `value, onValueChange, decks, onCreate, onEdit`; editor `value, onChange, errors{name,values}, saving, onSave, onCancel`.
- **States:** card default/hover/selected, "Créer un deck" dashed tile, chip editing, special card off, validation (< 2 values, duplicate, > 4 chars), saving.
- **Keyboard:** radiogroup roving; tag input Enter/`,` adds, Backspace removes, ←/→ between chips, Alt+←/→ reorder.
- **Realtime:** `DeckSaved`/`DeckDeleted` on `private-team.{teamId}`; a running game keeps a frozen copy.
- **Composes:** RadioGroup, Badge, Input, Switch, Button, Card, PokerCard.
- **Backend:** team saved decks CRUD, built-in decks (Fibonacci 13 cards, modified Fibonacci, T-shirt, powers of 2), deck snapshot per game, `½` normalisation.

### EmptyState
- **Props:** `module (retro|poker|whiteboard|survey|icebreaker|actions), title, description, illustration?, action{label,icon,onClick,href,variant}, secondaryAction`.
- **States:** first use (illustration + CTA), filtered-empty (no illustration, "Effacer les filtres"), positive (Actions up to date).
- **Realtime:** replaced by list on `RetroCreated`, `SurveyPublished`…
- Six bespoke SVG illustrations (no characters).

### ExcalidrawTheme (SkrumExcalidraw)
- **Props:** `boardId, theme light|dark, locale fr|en, defaultFill PostItColor, readOnly, initialElements, onChange`.
- **Content:** CSS override file `resources/css/excalidraw-theme.css` (full variable map given), palette module `resources/js/whiteboard/palette.ts` generated from `tokens.json` (8 post-it hex pairs), `UIOptions` disabling background change / theme toggle / export / load scene, `langCode`.
- **States:** active tool, hover, tooltip, selection, swatch active, undo/redo disabled, light/dark (canvas inverted by Excalidraw), mobile reduced toolbar.
- **Keyboard:** native Excalidraw shortcuts kept (1–9, 0, H, V, R, D, O, A, L, P, T, E…); ReactionBar 1–6 only when canvas is not focused.
- **Realtime:** `onChange`/`onPointerUpdate` relayed on `presence-board.{id}`; element diff by `version`/`versionNonce`; whisper `client-pointer` (50 ms).
- **Deps:** `@excalidraw/excalidraw` (installed 0.18.1) + its `index.css`; Excalifont kept for drawn content.

### FacilitatorBar
- **Props:** `phase, nextPhase{id,label}, timer{remainingMs,totalMs,paused}, cardsRevealed, boardLocked, focusedCard, compact, onTimerStart/Toggle/Add, onRevealToggle, onLockToggle, onFocusCard, onFocusNext, onNextPhase`.
- **States:** default, board locked, cards revealed, card focus pill, timer low, timer menu (3/5/10 min, +1 min, stop), compact mobile.
- **Keyboard:** toolbar ←/→; `R` reveal, `L` lock, `F` focus, `T` timer, ⌘/Ctrl+→ next phase.
- **Realtime:** HTTP → broadcast `CardsRevealed`, `CardsHidden`, `BoardLocked`, `BoardUnlocked`, `CardFocused`, `TimerStarted {endsAt}`, `TimerPaused`, `PhaseChanged`.
- **Composes:** Timer, Button, Toggle, DropdownMenu, Tooltip, Separator.
- **Backend:** board lock, card focus, co-facilitator role, confirm-before-reveal when < 50 % wrote.

### GamesLeaderboard (the Games page)
- **Props:** `team, rooms: GameRoom[] {id,name,game,status live|waiting|finished,players,minPlayers,startedAt,finishedAt}, leaderboard{period 30d|all, entries{userId,name,initials,presence,points,gamesPlayed,wins,isMe}}, onPeriodChange, canCreateRoom`. `GameKind = hangman|emoji|draw|two-truths|mood|who|quick-question`.
- **States:** room live / waiting / finished; leaderboard 30d / all, me in list, me on podium, < 3 players, empty.
- **Realtime:** `private-team.{id}.games`: `GameRoomCreated`, `GameRoomUpdated`, `GameRoomFinished`; leaderboard partial reload.
- **Backend:** route `/teams/{team}/games`; named rooms with status and min players; server-side points; leaderboard by period (games played, wins, points); rooms limited to last 7 days.

### GifPicker
- **Props:** `open, onOpenChange, categories[], initialQuery, rating g|pg, lang, selectedId, withCaption, captionMaxLength (60), onSelect(gif, caption), status idle|loading|empty|error|disabled`; `GifItem {id,title,durationMs,width,height,mp4,webp,still}`.
- **States:** trending, hover, loading, empty (3 suggestions), error (retry), selected, preview-before-send, reduced motion (still + play), disabled by admin.
- **Keyboard:** dialog, Esc; category tablist ←/→; listbox arrows, Enter choose, Space play/pause.
- **Deps:** GIPHY API via server proxy only; masonry by shortest column (no lib required; `react-masonry-css` cited as behaviour reference); ScrollArea, ToggleGroup, Popover/Drawer.
- **Backend:** `GET /api/gifs/search`, `GET /api/gifs/trending` → `GifController` (server-side key, forced `rating=g`, 10 min cache, `throttle:30,1`, trimmed payload); admin setting Administration → Intégrations → GIPHY (encrypted key, max rating, enabled); game hidden when disabled; "Powered by GIPHY" attribution.

### GuestJoin
- **Props:** `session{code, kind retro|poker|whiteboard|survey, title, status, participants, facilitator}, defaultName, takenColors[], error, processing, onSubmit{name,presence}, onRandomName, loginUrl`.
- **States:** filled, empty name (random pseudo), name taken, colour taken, loading.
- **Realtime:** `Echo.join("presence-session.{code}").here()` for taken colours; signed guest cookie then redirect.
- **Backend:** route `/s/{code}`; random pseudo generator; pseudo uniqueness per session; guest-chosen presence colour.

### HealthCheck (Manager, Form, Results)
- **Props:** `HealthStatement {id,label ≤24,text ≤120,builtIn,enabled,position}`; manager (`statements, canManage, onToggle, onReorder, onAdd, onEdit, onDelete`); form (`retroTitle, statements, answers 1..5, onAnswer, onSubmit, submitted`); results (`respondents, participants, previousRetroTitle, results[{distribution[5], mean, previousMean}], alertThreshold 3`).
- **States:** manager reorder / disabled / custom / add form; form answered / pending / progress / submitted; results normal / trend / alert < 3 / no previous / < 3 respondents hidden.
- **Keyboard:** dnd-kit keyboard sort; 1–5 on focused statement.
- **Realtime:** answers by `POST /retros/{id}/health-check`; `HealthCheckProgress {answered, participants}`, `HealthCheckResultsRevealed` on `presence-retro.{id}`.
- **Deps:** dnd-kit.
- **Backend:** 6 built-in statements (EN/FR table), custom statements per team (CRUD, reorder, enable), `statements_snapshot` frozen at first answer, aggregates only, trend vs previous retro of same team, 3-respondent anonymity floor.

### IcebreakerGameCard
- **Props:** `game (hangman|pictionary|emoji|two-truths), title, pitch, color, durationMin, players{min,max}, participants, selected, onSelect`.
- **States:** default, hover, selected, unavailable (reason "min. 3 joueurs").
- **Realtime:** `IcebreakerSelected {game}` on `presence-retro.{id}`; game on `presence-icebreaker.{id}`.

### KeyboardShortcuts
- **Props:** `open, onOpenChange, sections: ShortcutSection[] (general|retro|poker|whiteboard|reactions), context, platform mac|other, onPlatformChange, query, onQueryChange, onOpenCommandPalette`.
- **States:** macOS / Windows·Linux display, filtered search with highlight, no result, not shown on mobile.
- **Shortcut map:** General ⌘K, `?`, ⌘B · Retro N, ↵, Esc, V, G, F, ⌘→ · Poker 0–9, `?`, C (coffee), R, ⇧R, N · Whiteboard V, H, N, S, T, P, C, Space+drag, ⌘Z/⇧⌘Z, ⌘+/⌘− · Reactions 1–6.
- **Deps:** `react-hotkeys-hook`; `@/components/ui/kbd`, ScrollArea.
- **Backend:** user setting to disable single-letter shortcuts ("Réglages › Accessibilité").

### LiveCursor (+ CursorLayer)
- **Props:** `userId, name, presence, x, y, action (idle|dragging|drawing|typing), idle`; layer `cursors, visible, shareMine, viewport`.
- **Realtime:** whisper `client-cursor {x,y,action}` on `presence-whiteboard.{boardId}` at 20 Hz; never persisted.
- **Keyboard:** Shift+C toggles.
- **Backend/settings:** "Afficher les curseurs" and "Partager mon curseur" preferences.

### MoodTrendChart
- **Props:** `team, points: MoodPoint[] {sprint, mean, q1, q3, voters}, annotations[], threshold 3, range 4|8|all, onRangeChange, height`.
- **States:** default, hover, ranges, < 3 sprints, table view.
- **Realtime:** `RotiClosed` on `private-team.{teamId}` adds a point.
- **Deps:** inline SVG, or Recharts `ComposedChart`.
- **Backend:** per-sprint ROTI mean + quartiles + voter count, sprint label on retros, annotations (events), team history.

### NotificationsPanel
- **Props:** `notifications: AppNotification[] {id, kind (team_invite|session_starting|action_overdue|mention|recap_ready), readAt, createdAt, actor, team, session, action, excerpt, href}, unreadCount, tab all|unread, onTabChange, onMarkAllRead, onOpen, onInvite(id, accept|decline), onJoin, settingsHref (/settings/notifications), hasMore, onLoadMore`.
- **States:** bell none / count / 9+ / open / new arrival; item unread / read / hover / focus / invite answered / session started; empty; loading.
- **Realtime:** private channel `user.{id}`; optimistic mark-all synced across tabs.
- **Backend:** notifications store + read state, mark all read, accept/decline team invite inline, "starts in 5 min" reminder job, mentions on cards, recap-ready, grouping, pagination (20).

### PhaseStepper
- **Props:** `phases[{id, label, skipped}], current, interactive, compact, onPhaseChange`. `RetroPhase = icebreaker|writing|grouping|voting|discussion|actions|roti`.
- **States:** active, hover (facilitator), compact, read-only participant ("Camille pilote les phases"), skipped, mobile "Phase 4/7" + progress.
- **Keyboard:** roving ←/→, Enter; ⌘/Ctrl+→ next.
- **Realtime:** `PhaseChanged {phase, startedAt, timer?}`; policy facilitator only; `router.reload({only:['phase']})`.
- **Backend:** 7 phases incl. `icebreaker`, `actions`, `roti`; skippable phases; going back needs confirmation (votes may reset).

### PokerCard (+ PokerDeck)
- **Props:** `value, unit, faceDown, selected, disabled, empty, special, size sm|md|lg, onSelect`; deck `kind fibonacci|tshirt|custom, values, value, onChange`.
- **States:** face down, revealed, selected, focus, disabled, no vote, special, 3D flip (staggered 40 ms), reduced-motion fade.
- **Keyboard:** ←/→, Space, 0–9 direct, Esc retracts.
- **Realtime:** `POST /poker/{id}/votes`; `VoteCast {userId}` (no value), `VotesRevealed`, `RoundReset` on `presence-poker.{id}`.

### PokerTable
- **Props:** `story{key,title,url}, seats: PokerSeat[] {user, state waiting|voted|absent, value}, revealed, result{mean, median, mode, agreement, consensus, distribution, outliers}, isFacilitator, onReveal, onRevote, onAccept, onNext`.
- **States:** voting, revealed-spread, revealed-consensus, coffee excluded; > 12 seats → grid without table.
- **Keyboard:** `R` reveal, `N` next story, ⌘/Ctrl+↵ validate.
- **Realtime:** presence seats; `VoteCast`, `VotesRevealed {votes, result}` (server computes), `StoryChanged`, `RoundReset`, `EstimateAccepted` → Jira/Linear story points.

### PresenceStack
- **Props:** `participants: Participant[] {id,name,initials,presence,role facilitator|member|guest,status online|away|offline,typing,isMe}, max, size, onInvite`.
- **States:** stack + "+N", online/away (> 60 s)/offline, typing, anonymous guests, popover list.
- **Realtime:** `Echo.join('presence-retro.{id}')`; whispers `client-away`, `client-typing {cardId}`; presence colour assigned by server (lowest free index).

### ROTIWidget
- **Props:** `mode vote|result, value, onVote, result{mean, votes, distribution, previousMean, missing[]}, canClose, onClose`.
- **States:** none, hover, selected, sent (editable until close), aggregate result, waiting for last voters.
- **Keyboard:** 1–5 direct, ←/→.
- **Realtime:** `RotiVoteCast {count}`, `RotiClosed {mean, distribution}`.
- **Backend:** ROTI vote storage (anonymous), close action, previous-sprint mean.

### ReactionBar
- **Props:** `emojis (6), variant floating|inline, compact, compactEmojis, disabled, disabledReason, offsetBottom, incoming[], onReact, onOpenPicker, labels`.
- **States:** rest, hover, pressed (+1 fly), picker open, incoming burst (max 12 then aggregate), disabled (locked), mobile compact, mobile Drawer.
- **Keyboard:** toolbar roving; global 1–6; Esc.
- **Realtime:** whisper `client-reaction {emoji,userId}` on session presence channel; nothing persisted; `reactionsLocked` from `SessionUpdated`.
- **Placement rule:** never overlaps poker deck (`--deck-height` via ResizeObserver, or `variant="inline"`); stacks above FacilitatorBar. Needs theme animation `--animate-reaction-rise`.
- **Composes:** Button, Tooltip + Kbd, Popover + Command, Drawer, Separator.

### RetroCard
- **Props:** `id, text, color, author|null, masked, reactions[], votes{total|null, mine}, lockedBy, editing, selected, focused, dragging, ghost, canVote, onVote, onReact, onEdit, onDelete`.
- **States:** default, anonymous, masked, reactions + my votes, locked by other, editing (counter n/280), selected, facilitator focus, dragging + ghost.
- **Keyboard:** Enter edit, ⌘/Ctrl+Enter publish, Esc, V / Shift+V, Delete; dnd-kit keyboard drag.
- **Realtime:** `CardCreated`, `CardUpdated`, `CardMoved`, `CardDeleted`, `CardRevealed`, `ReactionToggled`; whisper `client-card.editing`; server withholds text during Writing; optimistic with server `version`.
- **Backend:** per-card emoji reactions (persisted), card `version`, masked payloads, 280-char limit.

### RetroColumn
- **Props:** `id, title, color, description, count, children, canAdd, isDropTarget, emptyHint, onAdd, onRename, onColorChange, onSort(votes|date)`.
- **States:** with cards, drop target, empty, add disabled (lock), title editing.
- **Keyboard:** `N` add card, ←/→ columns, ↑/↓ cards.
- **Realtime:** `ColumnUpdated`; count includes masked cards.
- **Backend:** column colour (8), description/help, max 6 columns per retro (TemplateEditor allows 8).

### RetroTemplatePicker
- **Props:** `value, onValueChange, templates: RetroTemplate[] {id,name,description,source builtin|workspace|recent,columns[{id,title,color,help}],defaults{votesPerPerson,maxPerCard,anonymous,timers},isTeamDefault,usageCount,workspaceName}, tab, onTabChange, query, onQueryChange, loading, onUse, onDuplicate`.
- **States:** default, hover, focus, selected, workspace tab, no result, loading, empty workspace tab.
- **Keyboard:** tabs ←/→, `/` focuses search, Esc clears, 2-D arrows in grid, Enter = use.
- **Backend:** built-in templates (Start·Stop·Continue, Glad·Sad·Mad, 4L, Voilier, Starfish, KALM, DAKI, blank), workspace templates, recents, team default template, usage count per team.

### SessionSettingsPopover
- **Props:** `open, onOpenChange, sessionTitle, phase, value: SessionSettings {anonymousCards, boardLocked, votesPerPerson 1..10, maxVotesPerCard, hideVotesUntilReveal, phaseTimerMinutes, showCursors, reactionsEnabled}, draft, onDraftChange, deferred[], readOnly, facilitatorName, surveys{healthCheckStatements, templates[]}, onAddSurvey(health_check|quick_poll|{templateId}), onApply, onReset, variant popover|sheet|drawer`.
- **States:** default, modified-unapplied, deferred effect warning, applied (toast + undo 5 s), "add survey" menu, read-only participant, non-modal Sheet, Drawer, sending.
- **Keyboard:** `,` opens; Esc; ⌘↵ applies; stepper ↑/↓.
- **Realtime:** `SessionSettingsUpdated {patch, appliesFrom}`, `SurveyAttached {kind}`.
- **Backend:** live settings patch with deferred application per phase (`appliesFrom`), undo, attaching a survey/health check/quick poll to a running retro (extra step after Actions, before ROTI), survey templates, co-facilitator conflict hint.

### SessionTypePicker
- **Props:** `value: SessionType (retro|poker|whiteboard|poll|icebreaker), onValueChange, options[{value,label,description,duration,disabledReason}], variant tiles|compact, label, help, as radiogroup|menu`.
- **States:** default, hover, focus, selected, disabled with reason.
- **Backend:** instance feature flags (e.g. `features.icebreakers = false`) filtering/disabling types.

### ShareDialog
- **Props:** `session{id,kind,title,teamName,presentCount}, invite{url, code, joinUrl, defaultRole participant|observer|facilitator, allowGuests, expiry 1h|24h|7d|session_end|never, expiresAt, status active|expired}, canManage, members[{id,name,email,presence,avatarUrl,inSession}], tab link|members, isMobile, onCopy, onDownloadQr, onChange, onRegenerate, onInvite(memberIds, role), onShare`.
- **States:** active link, copied, role select open, members combobox, regenerate confirm, expired link, guests disabled, read-only participant, mobile Drawer.
- **Realtime:** `InviteLinkRegenerated`, `InviteSettingsUpdated` on `presence-session.{id}`.
- **Deps:** a QR generator (none named; PNG 1024 px download), Web Share API.
- **Backend:** short session code (`ATL-4821`), `/join` code entry page, invite URL `/j/{code}-{token}`, default role incl. observer, allow-guests flag, link expiry, regenerate, invite team members to a session (notification/e-mail).

### SurveyQuestion
- **Props:** `id, index, count, type (scale5|nps|single|multiple|text), label, options, maxChoices, scaleLabels, anonymous, required, mode answer|results, value, results{responses, mean, nps, buckets, keywords, quotes}, onChange`.
- **Realtime:** `ResponseSubmitted {questionId,count}`, `ResultsPublished` on `presence-survey.{id}`; aggregates hidden under 3 responses.
- **Backend:** NPS type, keyword extraction for free text, quotes.

### TemplateEditor (+ ColumnColorPicker)
- **Props:** `mode create|edit, value: TemplateDraft {name, description, visibility personal|team|workspace, columns[1..8]{id,title,help,color}, defaults}, onChange, errors, canShareWorkspace, meta{editedBy, editedAt, usedByTeams}, saving, onSave, onCancel, onDuplicate, onDelete`; picker `value, onValueChange, usedBy, columnTitle`.
- **States:** default, empty title, duplicate title, picker open, colour used elsewhere (swap), dragging, 8 columns reached, saving, error summary.
- **Keyboard:** dnd-kit sortable; Delete removes column (undo toast).
- **Deps:** `@dnd-kit/sortable`.
- **Backend:** template visibility (personal/team/workspace), optimistic `version` conflict ("Modifié par Théo" Reload/Overwrite), edited-by metadata, "save as team template" from session creation.

### Timer
- **Props:** `endsAt, totalMs, pausedRemainingMs, size md|lg, lowThresholdMs, controls, onPause, onResume, onAdd, onReset, onDone`.
- **States:** normal, low (< 1 min), done, paused, large.
- **Keyboard:** `T` pause/resume, `+` adds 1 min.
- **Realtime:** `TimerStarted`, `TimerPaused`, `TimerResumed`, `TimerExtended`; server clock offset at connection; optional "lock at end".

### VoteDots (VoteBudget, CardVotes)
- **Props:** `total, remaining`; `mine, total|null, maxPerCard, budgetLeft, onVote, onUnvote`.
- **States:** budget full / partial / exhausted, votes on card, disabled with tooltip, pop animation, total hidden.
- **Keyboard:** V / Shift+V.
- **Realtime:** `VoteCast`/`VoteRetracted` on `private-retro.{sessionId}.votes`; my votes via `private-user.{userId}`; `VotesRevealed`.
- **Backend:** max votes per card, hidden totals, per-user private channel.

### WhiteboardToolbar
- **Props:** `tool (select|hand|sticky|shape|text|pen|connector), orientation, stickyColor, canUndo, canRedo, zoom, minimapOpen, onToolChange, onStickyColorChange, onUndo, onRedo, onZoom, onFit, onMinimapToggle`.
- **Keyboard:** V, H/Space, N, R, T, P, C, −/+, Shift+1, M, ⌘Z.
- **Realtime:** `ObjectCreated/Updated/Deleted` on `presence-whiteboard.{boardId}`; whisper `client-stroke`.

### Emails (5 transactional templates)
- **Types:** `MailBrand`, `MagicLinkMail` (15 min), `InvitationMail` (team|workspace, 7 days), `OverdueActionsMail`, `RetroSummaryMail` (stats, actions, ROTI distribution), `TwoFactorCodeMail` (10 min, request context browser/os/city).
- **Build:** one Mailable per mail (`ShouldQueue`, localised `lang/{fr,en}/mail.php`); reminders via Notification `OverdueActionsReminder`; Markdown mail components + theme `skrum.css`, or MJML (`mjml` CLI / `spatie/laravel-mjml`); hex table derived from tokens; bulletproof button with VML; dark-mode media queries; `List-Unsubscribe` + one-click headers; signed unsubscribe URLs; local `/mail-preview/{mail}` route.
- **Backend:** magic-link login, 2FA code by e-mail, team/workspace invitations with personal message, overdue reminders respecting notification prefs, retro recap mail, `BrandPalette::toHex()` (to add next to `css()`), white-label sender name, "Powered by Skrüm" toggle.

---

## 3. Family C — screens

Common chrome in most app screens: unified Sidebar (expanded or `is-collapsed`), topbar with breadcrumb, `⌘K` search field and bell button.

### ScreenAuth — FR only, light
- **Regions:** split; left form pane, right brand pane (`--secondary`, dot grid, 2 RetroCards + 1 ActionItem); two variant cards below.
- **Controls:** Continue with SSO (OIDC), Google, GitHub, e-mail field, password field (show/hide), "Mot de passe oublié ?", checkbox "Rester connecté 30 jours", Se connecter, "Recevoir un lien magique à la place", "Créer un compte", footer links Confidentialité / Conditions. Signup variant: name, team name, e-mail (error), password (12 chars min), "Créer mon compte". Magic-link-sent variant: "Ouvrir ma messagerie", "Renvoyer dans 0:42" (disabled), "Utiliser une autre adresse".
- **Data:** instance host + version (`skrum.nordlys.fr · v1.8.2`).
- **Components:** Button, Input, Checkbox, Alert, Card, RetroCard, ActionItem, Badge.
- **Backend implied:** OIDC + Google + GitHub login, magic link (15 min, single use, resend cooldown), forgot password, remember 30 days, signup creating a team, instance name/version, admin flags to hide social providers or force SSO only, free-plan limit text.

### ScreenDashboard — FR only
- **Regions:** expanded sidebar; topbar; team header; 4 create tiles; recent sessions table; open actions; mood trend; activity feed.
- **Controls:** team switcher, nav links, user menu, search ⌘K, bell, Inviter, Nouvelle session, tiles (Nouvelle rétro, Planning poker, Whiteboard, Sondage), "Toutes les sessions", Rejoindre, "Tout voir", action checkboxes.
- **Data:** team name, member count, current sprint, next retro date; sessions (type, title, subtitle, date, participants, status En direct/Terminée/Brouillon, result counts); open-action count, overdue count, actions (owner, priority, due, ticket, origin retro); ROTI mean per sprint S35→S42 with delta; activity feed (actor, sentence, time).
- **Backend implied:** current sprint + scheduled next retro, session draft status, team activity feed, ROTI trend, overdue counter for sidebar.

### ScreenTeam — EN + FR
- **Regions:** sidebar (Sessions active), topbar (breadcrumb Nordlys › Teams › Atlas), team header, 4 create tiles, Retrospectives SessionCard grid, Planning poker table, Whiteboards thumbnails, right aside (Health check, Members).
- **Controls:** Open action items (7), Games, Team settings, 4 tiles, View all, New retrospective, Join/Resume/Summary, Estimation history, Saved decks, New game, Join/Open, New whiteboard, Manage (health check), Invite, Show 3 more.
- **Data:** retro phase badge (Writing/Voting/Closed), template name, joined count, cards, groups, action items, ROTI per closed retro, facilitator; poker games (tasks, estimated, in the room, deck, points, last activity); whiteboards (name, facilitator, date); 6 health statements; members with e-mail and role.
- **Backend implied:** retro summary page, per-retro ROTI average, poker game aggregates, whiteboard thumbnails/facilitator, health check statements per team.

### ScreenWorkspace — EN + FR (4 frames: workspace ×2, templates ×2)
- **Workspace frame:** workspace switcher menu open (list with team count + role, ⌘2/⌘3, New workspace); header (3 teams · 24 members · role; Invite people, New team); team cards (colour mark, description, 3 activity lines, member stack, Open →); New team tile; Leave workspace zone with inline alertdialog (consequences, type name to confirm, Leave / Cancel).
- **Templates frame:** tabs All / Retro·4 / Poker·2 / Whiteboard·0, search, New template; retro template cards (column preview, columns count, used n×, author, Use); poker templates (deck preview, timer / auto-reveal settings, Use); whiteboard empty state + "New whiteboard template".
- **Backend implied:** multiple workspaces per user with roles, create workspace, leave workspace (admin count check), team description + colour, per-team live activity summary, workspace-level templates of three kinds (retro, **poker**, **whiteboard**), template usage counts and authors, invite people to workspace.

### ScreenSessionCreate — EN + FR (retro and poker variants)
- **Regions:** Sessions page behind overlay (tabs Upcoming / Live / Finished, search, list rows); dialog with type tiles, left column, right settings, footer.
- **Retro controls:** Name; template radio (Start·Stop·Continue, 4L, Glad·Sad·Mad, Sailboat, workspace template, Browse / All templates); columns list with reorder handle, Add a column, colour radiogroup; switches Anonymous cards, Health check, ROTI at the end, Anonymous guests allowed; steppers Votes per person, Max per card; selects Timer per phase ("Custom (5 phases)": Writing 7 · Voting 3 · Discussing 15), Icebreaker at the start (game select, "Pictionary"); invite link + Copy link; checkbox Save as team template; Cancel; Create & open.
- **Poker controls:** Name; deck radio (built-in + saved, New deck) with value preview; Tasks tabs Import from Jira / Type them / Later; JQL field; ticket checklist, Select all; switches Auto reveal, Facilitator "Watch only", Change vote after reveal; selects Timer per task, Write estimates to Jira (field); invite; Schedule…; Create & open.
- **Backend implied:** Sessions index with upcoming/live/finished, scheduling, per-phase timers, icebreaker-at-start with chosen game, health-check and ROTI toggles per retro, per-column help text, Jira JQL import, write-back field mapping, watch-only facilitator, revote-after-reveal flag, invite link created up front.

### ScreenRetroWriting — FR only
- **Regions:** collapsed sidebar; topbar (title, PhaseStepper 7 phases, Timer, PresenceStack, Partager); help banner with counter; 4 columns; live cursors; FacilitatorBar.
- **Controls:** Partager, Ajouter une carte (×3), card editor (↵ / Esc, 68/280), FacilitatorBar: Pause, +2 min, Anonymat : activé, Révéler les cartes, Regroupement →.
- **Data:** "16 cartes · 6/8 ont écrit", masked cards, "Visible par vous", typing indicators.
- **Backend implied:** who-has-written count, masked payloads, anonymity toggle in-session.

### ScreenRetroGrouping — EN + FR
- **Regions:** as Writing plus back button, settings icon and share icon in topbar; help banner; facilitator-only suggestion region; 4 columns with groups; cursors; ReactionBar above FacilitatorBar.
- **Controls:** Dismiss, Auto-group duplicates, Collapse group, group title edit (↵ / Esc), drag handles, ReactionBar (6 + add), FacilitatorBar: +2 min, Lock board, Undo last group, Voting →.
- **Data:** "3 groups · 13 cards", "8 online", "Likely duplicate" tags.
- **Backend implied:** duplicate-card detection and auto-grouping, undo last group, groups restricted to one column.

### ScreenRetroVote — FR only
- **Regions:** topbar; vote bar (budget, hidden-votes badge, "5/8 ont terminé"); 4 columns with groups and cards; cursors; FacilitatorBar.
- **Controls:** Voter buttons, group vote, FacilitatorBar: +2 min, "5 votes / pers.", Révéler les votes, Discussion →.
- **Backend implied:** "finished voting" per participant, vote on group, hidden totals, max per card.

### ScreenRetroDiscussion — EN + FR
- **Regions:** topbar; left Topics list sorted by votes with progress footer; centre focus banner, prev/next, per-topic timer, focused CardGroup, "Up next"; right Discussion notes + Topic actions; ReactionBar + FacilitatorBar.
- **Controls:** sort "By votes", Previous topic, +1 min, Next topic, Everyone follows (toggle), skip back/forward, Actions →, Create an action (inline form: title, assignee, due, priority, ticket; Cancel / Create).
- **Data:** topic rank, votes, discussed status + action count, "Now · 04:12 left", "Topic 2 of 6 · ~20 min left · 5 min per topic · 3 actions so far", 8/8 following, collaborative notes ("Saved", "Inès is taking notes…").
- **Backend implied:** topics = groups/cards ordered by votes, discussed flag, per-topic timer, `FocusChanged` follow mode, **collaborative discussion notes per topic** (included in recap), actions linked to a topic.

### ScreenRetroActions — FR only
- **Regions:** topbar (stepper on Actions); left most-voted topics; right actions card with quick-add form and list; FacilitatorBar bottom-left; success toast.
- **Controls:** Exporter vers Jira, quick add (title, assignee, priority, due, ticket, Créer; ↵ / ⌘J creates Jira ticket too), action checkboxes, row "…" menus, "Lier à Jira", Sujet suivant, Clôturer la rétro, toast Annuler.
- **Backend implied:** create Jira ticket on action creation, bulk export to Jira, undo creation, previous-retro overdue actions carried into the list.

### ScreenRetroROTI — EN + FR (4 frames: ROTI ×2, session end ×2)
- **ROTI frame:** stepper 7/7, timer low; ROTIWidget (5 options, "Vote saved"), hidden distribution; "Who has voted" 6/8 list; ReactionBar; FacilitatorBar: Nudge the last 2, Reveal ROTI, End session.
- **End frame:** all phases done + "Ended" badge; header "Session ended · 58 min · date", Back to the team, Export ▾ (PDF/CSV/Markdown/Jira per README), Email the recap; 5 stats (actions created, participation 8 of 9 · 89 %, cards, groups, votes cast 34 of 40); actions list; average ROTI 3.8/5 with delta vs S41, distribution, sparkline S35→S42; health check (6 scores, deltas, alert); ReactionBar; frozen confetti.
- **Backend implied:** who-voted list without values, nudge, reveal ROTI, **end session + session-end page**, session duration, participation rate, export PDF/CSV/Markdown/Jira, recap e-mail, ROTI history, health-check aggregates with deltas.

### ScreenPokerBefore / ScreenPokerAfter — FR only
- **Regions:** collapsed sidebar; topbar (game title, badges "Planning poker" + round state, Timer, PresenceStack, Partager); story card; table with 8 seats; ReactionBar; deck panel (Before) or result panel (After); right story queue + facilitator settings.
- **Controls:** Révéler les cartes, deck radiogroup (0–21, ?, ☕), ReactionBar, Ajouter une story, Importer depuis Jira, auto-reveal switch; After: final estimate cards, "Valider 5 pts · Story suivante", Revoter, "Lucas & Malik" (open discussion with extremes).
- **Data:** ticket key + type + label + position "3 / 6", title, description, acceptance criteria; "7 / 8 ont voté"; queue with estimated points, "11 pts estimés"; observers "1 (Hugo)"; After: mean 6,5, median 5, dispersion 3 → 13, consensus 50 % on 5, distribution.
- **Backend implied:** story description + acceptance criteria (from Jira), story type/labels, observers, auto-reveal, round number, total estimated points.

### ScreenPokerQueue — EN + FR (4 frames: room ×2, pages ×2)
- **Room:** no sidebar in this frame; topbar (back, deck badge, **Watch only** switch, Hide tasks, presence, settings); observer banner with "Join the vote"; story card with Edit/Delete task and **Rounds (2)** collapsible; table with observer box; ReactionBar; deck panel disabled with Re-vote / Estimate select / Save estimate / Next task; right Tasks (drag handles, "Votes: n", round badge, Add a task, facilitator settings).
- **Pages:** *Estimation history* (search, filters deck / game / period, "Re-voted only", table Task · Estimate · Deck · Date · Voters · Rounds, pagination, Export CSV); *Saved decks* (deck cards with usage, Default badge, built-in locked with Duplicate, custom Edit/Duplicate, "Create a custom deck", New deck).
- **Backend implied:** watch-only mode, round history per task with all votes, task CRUD + reorder, vote counts per task, estimation history query + CSV export, deck usage counts, default deck.

### ScreenWhiteboard — FR only
- **Regions:** standalone topbar (logo, editable breadcrumb, sync state, presence, comments, Exporter, Partager); dot-grid canvas with frames, stickies, shapes, connectors, pencil; selection frame + contextual toolbar; cursors; vertical toolbar left; history bottom-left; zoom + minimap bottom-right.
- **Controls:** Renommer, Commentaires, Exporter, Partager; selection toolbar: 8 colours, Grouper, Aligner, Verrouiller, Convertir en actions, Supprimer; tools: Sélection (V), Main (H), Post-it (S), Forme (R), Connecteur (C), Texte (T), Crayon (P), Gomme (E), Cadre (F), Image; Annuler, Rétablir; Dézoomer, 80 %, Zoomer, Tout afficher, Minimap.
- **Backend implied:** whiteboard rename, export, **comments**, **convert selected stickies to actions**, sticky authors, edit lock.

### ScreenIcebreaker (hangman) — FR only
- **Regions:** collapsed sidebar (Jeux active); topbar (back to retro, breadcrumb Atlas › Rétro sprint 42 › Icebreaker, duration badge, timer, players, "Passer à la rétro"); left game picker + round settings; stage (round, turn timer, gallows, errors, word, turn banner, AZERTY keyboard, whole-word guess, ReactionBar); right scores, speaking order, last moves.
- **Controls:** 6 game tiles (Le pendu, 2 vérités 1 mensonge, Météo de l'humeur, Devine qui ?, Sprint en emojis, Question express), selects Thème des mots / Temps par tour, switch Invités autorisés, letter keys, Proposer, ReactionBar.
- **Backend implied:** icebreaker as a retro phase room, word themes, turn order, scoring (+50 whole word, −1 life), game catalogue of at least 6 games.

### ScreenIcebreakerDraw (Pictionary) — EN + FR (drawer and guesser views)
- **Regions:** collapsed sidebar; topbar (back to games, "Atlas · Games · Monday warm-up", game badge, Round 3 / 6, players, Invite, Game settings); left players ranking, drawing order, round settings; stage (word card, canvas, drawing toolbar for drawer, ReactionBar); right Guesses log, "Found by", guess input.
- **Controls:** New word (1), Pencil (P), Eraser (E), 3 stroke widths, Ink + 8 colours, Undo, Redo, Clear; selects Word list / Time per turn, switch Auto hints; guess input + Guess.
- **Backend implied:** secret word never sent to guessers, server-side "Almost!" (Levenshtein ≤ 2), auto hints schedule, scoring (+120/+90, +40 per finder), word lists, stroke broadcast (30 ms throttle), named game rooms.

### ScreenIcebreakerEmoji — EN + FR
- **Regions:** left Rounds list (solved / current / hidden) + settings; stage (emoji puzzle, meta badges, 3 progressive hints, feedback alert, answer field, found chips, attempts); right round leaderboard + totals.
- **Controls:** selects Categories / Time per round, switch Auto hints, answer input + Answer, "Hint now (−20)", ReactionBar.
- **Backend implied:** puzzle bank by category, hint timing and penalty, server-side answer checking, per-round and cumulative scoring.

### ScreenIcebreakerGif — EN + FR (step 1 and step 3)
- **Step 1:** left participants status + progress + steps + settings (Theme, Votes "2 each", Hide authors until votes); stage prompt + open GifPicker; right "Your pick" (preview, caption 20/60, Send my GIF, Change, hidden sent picks).
- **Step 3:** left vote budget + who voted; stage gallery of GIF cards (author, votes, caption, reactions, heart vote), winner tag, "Votes closed"; right winner panel, ranking, **Pin to the sprint 42 retro**, New round, copy gallery link.
- **Backend implied:** GIF game state machine (pick → reveal & vote → winner), per-GIF votes and reactions, hidden authors, pin winner GIF to a retro, shareable gallery link, GIPHY proxy.

### ScreenSurvey — FR only (3 frames)
- **a) Builder:** sidebar; topbar (draft badge, autosave, Aperçu, Publier); question list with reorder, type select, Required switch, Duplicate, Delete, label + scale bound labels; add bar with 5 types; right settings: anonymity radio (Anonyme / Nominatif / Au choix du participant), switches One question at a time, Show results after answering, Allow guests; Clôture date select ("or once 11/11 answered"); display threshold select.
- **b) Answer:** minimal chrome, progress "Question 2 sur 5", NPS 0–10, optional comment, Précédent / Suivant.
- **c) Results:** topbar (Clôturé, Exporter CSV, Partager à l'équipe); tabs Synthèse / Réponses libres / Comparer au sprint 41; result cards; "Envoyer au whiteboard"; "Voir les 7 réponses".
- **Backend implied:** survey draft autosave + publish, anonymity modes, close date / auto-close, threshold, guest answering, CSV export, share to team, **compare with previous sprint**, send free-text answers to a whiteboard, keyword counts, optional comment per question.

### ScreenActions — FR only
- **Regions:** sidebar; topbar (search, Exporter, Nouvelle action); header with counters + "Grouper par" segmented; faceted filter bar; table with sprint group rows; floating bulk bar.
- **Controls:** group by Sprint / Équipe / Responsable / Aucun; filters Équipe, Statut, Responsable, Priorité, Échéance, Source, "En retard" shortcut, Réinitialiser; row checkbox, "Lier", row menu; bulk Statut, Assigner, Échéance, Priorité, Synchroniser vers Jira, Supprimer, deselect.
- **Data:** "28 actions ouvertes ou récentes · 4 en retard · issues de 9 rituels"; source (retro, whiteboard, survey); status; owner; priority; due (late, J-3 warning, done date); ticket (Jira / Linear, sync icon); sprint groups with dates and state.
- **Backend implied:** actions sourced from whiteboards and surveys too, sprint entity with date range, cross-team filter, export, manual action creation, bulk update, bulk sync to Jira, Linear integration.

### ScreenSettings — FR only (2 frames)
- **a) Team settings:** tabs Général / Membres & rituels / Intégrations / Données & export; members table (role select Propriétaire / Facilitateur·rice / Membre / Observateur·rice, last activity, pending invitation + Renvoyer / cancel), Lien d'invitation, Inviter; default facilitators chips + rotation switch with next facilitator; default retro template radio; default columns with reorder and 8-colour palette.
- **b) Instance admin:** main sidebar (Administration active) + admin sub-navigation (Général, Branding, Authentification SSO, SMTP, Intégrations, Clés MCP, Licence, Utilisateurs, Journal d'audit; host + version "à jour"); topbar (Self-host badge, "2 modifications non enregistrées", Annuler / Enregistrer). Branding: logo upload, display name, primary colour with contrast badge and auto-adjust notice, radius segmented (Carré / Doux / Standard / Rond), **avatar style radiogroup** (Initiales, Notionists, Thumbs, Lorelei, Glass, Shapes, Fun Emoji, "31 styles") + switch "members can choose", live preview with Clair / Sombre toggle, "Revenir à Skrüm". SSO/OIDC: enable, issuer, client ID, secret, redirect URI, e-mail fallback switch, Test connection. SMTP: host, port, encryption, user, password, sender, test e-mail. Integrations: Slack, Jira Cloud, Linear (switch, Configurer / Connecter). Licence: edition, seats 38 / 50, expiry, update key. MCP keys: table (name, fingerprint, scopes, created by, last used, Révoquer), Créer une clé.
- **Backend implied:** team roles incl. owner and observer, last-activity per member, team invitation link, default facilitators + rotation, team default template/columns, team "Data & export"; instance branding (logo, name, colour, radius, avatar style), licence/seats, users admin, audit log, instance-level MCP keys with scopes, version check.

### ScreenUserSettings — EN + FR
- **Regions:** sidebar; topbar; sticky sub-nav (Profile, Security, Appearance, Notifications, API tokens); stacked cards.
- **Controls:** 12 presence colours radiogroup, Upload photo, Use initials, Name, Email (Verified badge), Save; Delete account; theme System / Light / Dark radio cards; language English / Français; Reduce animations switch; notification table with In-app / Email switches per event (6 events); token form (name, expiration select, scope checkboxes `retros:read`, `retros:write`, `actions:read`, `actions:write`, `poker:read`, `mcp`), Create token, copy-once field, tokens table with Revoke.
- **Backend implied:** user-chosen presence colour, profile photo upload, e-mail change with confirmation link, account deletion (cards kept as "Ancien membre"), appearance + language + reduced motion stored on account, notification preferences per event × channel, weekly digest (Monday 9:00), "due tomorrow" reminder, "estimate saved on my task" event, personal API tokens with scopes + expiry + last used.

### ScreenSecurity — EN + FR
- **Regions:** sidebar + `.sk-subnav` "Account"; topbar; cards Password, 2FA (setup, recovery codes, enabled), Active sessions, Linked accounts.
- **Controls:** current / new / confirm password with show-hide and strength meter, Update password; QR + manual key Copy, 6-box OTP, Enable 2FA, Cancel; recovery codes Download .txt / Copy / Print, checkbox "I have saved my recovery codes", Finish; Change device, Regenerate codes, Turn off 2FA; Sign out other sessions, per-row Sign out; Unlink (SSO disabled, Google), Link GitHub.
- **Data:** "Last changed 8 months ago", breach check, 2FA added date + last used, "8 of 10 left", sessions (device, browser, OS, city, last active, "This device", "Unusual location"), linked accounts with dates.
- **Backend implied:** Fortify TOTP + recovery codes, password changed timestamp, `uncompromised()` rule, database session driver listing, GeoLite2 city lookup, unusual-location flag, sign out others, linked social accounts (link/unlink, last-method guard), admin-enforced 2FA.

### ScreenOnboarding — EN + FR (onboarding + accept-invitation)
- **Onboarding:** no sidebar; header with 4-step stepper (Workspace, Team, Invite, First ritual) and Log out; step 2 full (team name, team colour radiogroup of 8, team link slug with Edit, description; Back, Skip for now, Continue) with live preview pane; reduced cards for step 1 (workspace name, logo upload, default language), step 3 (e-mail chips, role select, invite link "Expires in 7 days · up to 20 people", Skip, Send 3 invitations), step 4 (ritual radio Retro / Poker / Whiteboard / Icebreaker, optional date, "Go to the dashboard instead", Create the retro).
- **Accept invitation:** card with inviter, team, role, message; SSO / Google / GitHub; locked e-mail; create password; "Create my account and join Atlas"; Sign in; Decline invitation. Variants: already signed in (Join / Decline / Switch account), expired ("Ask for a new invitation"), declined.
- **Backend implied:** resumable onboarding state per step, workspace logo + default language, team colour + slug + description, bulk e-mail invitations with role, team invite link with expiry and max uses, first-ritual scheduling, invitation accept/decline with inviter notification, request new invitation, SSO-forced flow skipping step 1.

### ScreenErrors — EN + FR
- **Regions:** 4 full pages (404, 403, 500, 503) each with header (logo, Instance status, Help), centred illustration + text + actions, footer (instance + version); plus an in-session connection-lost frame (collapsed sidebar, topbar with ConnectionState, banner, board, banner-states legend).
- **Controls:** Back to my teams, Search sessions ⌘K; 403: message field, Request access, Switch account; 500: Copy error ID, Try again; 503: Retry now; banner: Retry now.
- **Backend implied:** custom Inertia error pages, **access request to a team** (message to admins, team admin list), error ID = `X-Request-Id`, maintenance page via `php artisan down --render` with retry time + admin message, instance status and help links, local offline queue ("Waiting to send").

### ScreenLanding — FR only
- **Regions:** nav; hero; product preview; modules grid; self-host section; pricing; final CTA; footer.
- **Controls:** nav links (Modules, Self-host, Tarifs, Documentation, Changelog), GitHub, Se connecter, Essayer gratuitement, Lancer une rétro gratuite, Déployer chez vous, copy `docker compose` command, tabs Docker Compose / Helm, copy code, plan buttons (Commencer, Essayer 14 jours, Nous contacter), Lire le guide d'installation, Voir le code, footer links.
- **Data:** marketing copy, pricing (Gratuit 0 €, Équipe 8 €/membre/mois, Organisation sur devis, self-host free), AGPL-3.0, image `ghcr.io/skrum/skrum:1.8`, Helm chart.
- **Backend implied:** public landing route and content, plans/billing and plan limits (1 team, 10 participants per session, 3-month history), SAML/SCIM, docs/changelog/status/legal pages. README flags licence, prices and image paths as placeholders "à valider".

### MobileAccess — FR only (3 phones)
- Landing (Se connecter, Lancer une rétro gratuite, **Rejoindre avec un code**, module list); Login (SSO first, segmented Lien magique / Mot de passe, e-mail, Recevoir le lien magique, success alert, Créer un espace); Guest join (invitation card, pseudo, 12 colours with taken ones marked, Rejoindre la rétro, Se connecter).
- **Backend implied:** join-by-code entry.

### MobileDashboard — FR only (3 phones)
- Dashboard (team switcher, search, live session card "Reprendre la session", 4 ritual shortcuts, Mes actions, bottom tab bar Accueil / Sessions / Actions / Moral / Plus); Actions (filter chips À moi 6 / En retard 2 / Ouvertes 24 / Terminées, sort & group button, grouped by origin retro, Modifier); Settings (Membres & rôles, Modèles de rétro, Intégrations; Instance: Branding, SSO · OIDC, SMTP, **Sauvegardes**; Quitter l'équipe).
- **Backend implied:** "my actions" filter, leave team, instance backups status.

### MobilePoker — FR only (3 phones)
- Before reveal (story, participant row, "Critères d'acceptation 4", "Stories similaires · 5 pts en moy.", deck strip, Tout le deck); Drawer (full deck grid, Valider 8 points, Retirer mon vote); After reveal (cards, mean / median / spread, distribution, alert, retained estimate, Revoter, Valider 8 pts · story suivante).
- **Backend implied:** similar stories with average points.

### MobileRetro — FR only (3 phones)
- Writing (compact stepper, column tabs, masked cards, FAB add, compact FacilitatorBar: timer, Révéler, phase suivante); Vote (sticky budget, ± steppers, "J'ai terminé de voter"); Actions (top topics, Drawer: text, assignee chips, priority segmented, due "Fin du sprint 43", switch "Créer un ticket Jira", Ajouter l'action).

### MobileRituals — FR only (3 phones)
- Whiteboard read mode ("Lecture", "Suivre Camille", toolbar: move, fit, react, comments, Modifier); Survey (progress "Question 3 sur 8", category, 1–5 scale, optional comment, prev / next); Hangman (score chips, gallows, hint, missed letters, AZERTY keyboard, Deviner le mot).
- **Backend implied:** whiteboard follow-a-user mode, comments, survey question categories, hangman hints.

---

## 4. Consolidated lists

### 4a. npm dependencies implied by the design system

| Package | Cited by | Installed? |
|---|---|---|
| `recharts` | Chart README (shadcn chart); MoodTrendChart README (optional `ComposedChart`) | no |
| `cmdk` | Command README; Select README (Combobox); ReactionBar, ShareDialog, ActionItem READMEs (search pickers) | no |
| `vaul` | Drawer README; used by NotificationsPanel, ShareDialog, SessionSettingsPopover, GifPicker, ReactionBar, SessionTypePicker | no |
| `react-day-picker` v9 | DatePicker README | no |
| `date-fns` (locales `fr`, `enUS`) | DatePicker README | no |
| `@tanstack/react-table` | Table README | no |
| `react-hotkeys-hook` | KeyboardShortcuts README | no |
| `react-hook-form` | Input README ("si besoin") | no |
| `input-otp` | InputOTP README, ScreenSecurity README | yes |
| `sonner` | Sonner README | yes |
| `@dnd-kit/core`, `@dnd-kit/sortable` | RetroCard, RetroColumn, HealthCheck, TemplateEditor READMEs | yes |
| `@excalidraw/excalidraw` | ExcalidrawTheme README | yes (0.18.1) |
| `@dicebear/core`, `@dicebear/collection` | AvatarStylePicker README (client-side option; server-side PHP is the default) | no (PHP `dicebear/*` is) |
| `laravel-echo`, `pusher-js` | all realtime sections | yes |
| `lucide-react` | every README | yes |
| `class-variance-authority` | Button, Badge READMEs | yes |
| Radix primitives behind shadcn `accordion`, `collapsible`, `alert-dialog`, `dialog`, `dropdown-menu`, `popover`, `tooltip`, `select`, `radio-group`, `switch`, `checkbox`, `slider`, `progress`, `tabs`, `toggle`, `toggle-group`, `scroll-area`, `separator`, `avatar`, `label` | respective READMEs | not checked individually |
| shadcn `kbd` component | KeyboardShortcuts, ReactionBar, WhiteboardToolbar READMEs | not checked |
| QR code generator (unnamed) | ShareDialog README (QR + PNG download); ScreenSecurity uses Fortify's server SVG instead | no |
| `mjml` CLI or `spatie/laravel-mjml` (composer) | Emails README, option B | no |
| GeoLite2 reader (composer) | ScreenSecurity README | not checked |
| `react-masonry-css` | GifPicker README — cited only as a behaviour reference, not required | no |

No README mentions Embla / carousel.

### 4b. Backend data and routes implied by the mockups

**Auth and account**
- Magic-link login, 15 min, single use, resend cooldown — ScreenAuth, MobileAccess, Emails.
- OIDC SSO + Google + GitHub login; admin can hide providers or force SSO only — ScreenAuth, ScreenOnboarding, ScreenSettings.
- Forgot password; "remember 30 days" — ScreenAuth preview.
- 2FA: TOTP with QR, manual key, recovery codes (download/copy/print, regenerate), disable with code, admin-enforced — ScreenSecurity. 2FA / verification **code by e-mail** (6 digits, 10 min, resend 60 s, request context) — Emails, InputOTP.
- Device sessions list with city geolocation, "unusual location", sign out one / others — ScreenSecurity.
- Linked accounts (link/unlink, last-method guard) — ScreenSecurity.
- Password strength + breach check; other sessions signed out on change — ScreenSecurity.
- Profile: presence colour, photo upload / initials, e-mail change confirmation, delete account — ScreenUserSettings.
- Appearance (theme, language, reduce animations) stored on account — ScreenUserSettings; single-letter-shortcut opt-out — KeyboardShortcuts; week start — DatePicker.
- Notification preferences (6 events × in-app / e-mail), weekly digest — ScreenUserSettings.
- Personal API tokens (scopes, expiry, last used, revoke, shown once) for REST + MCP — ScreenUserSettings.

**Onboarding, workspaces, teams**
- 4-step resumable onboarding (workspace, team, invite, first ritual) — ScreenOnboarding.
- Workspace: logo, default language, list/switch, create, leave (type-to-confirm), invite people, roles (admin / member) — ScreenWorkspace, Sidebar, ScreenOnboarding.
- Team: colour, slug (`/t/{slug}`), description, roles owner / facilitator / member / observer, last activity, pending invitations (resend / cancel), invite link (expiry, max uses), default facilitators + rotation, default template + default columns, leave team — ScreenSettings, ScreenOnboarding, MobileDashboard.
- Invitation accept / decline / expired / request new; inviter notified — ScreenOnboarding, Emails, NotificationsPanel.
- Request access to a team from the 403 page — ScreenErrors.
- Pages with nav entries but no mockup: Sessions index (only as a backdrop), Mood & ROTI, Members — Sidebar, ScreenSessionCreate.

**Sessions (all types)**
- Sessions index with Upcoming / Live / Finished, drafts, scheduling ("Schedule…", next retro date) — ScreenSessionCreate, ScreenDashboard, ScreenTeam.
- Invite: short code, `/join` code entry, `/j/{code}` link, default role, allow guests, expiry, regenerate, QR, invite members — ShareDialog, MobileAccess. Guest join at `/s/{code}` with pseudo + colour — GuestJoin.
- Instance feature flags per session type — SessionTypePicker.
- ⌘K command palette: actions, recent sessions (live first), navigation, session search — Command, ScreenErrors, ScreenDashboard.
- Notifications centre (bell): invites, session starting in 5 min, overdue action, mention on a card, recap ready — NotificationsPanel.
- Team activity feed — ScreenDashboard.

**Retro**
- 7 phases: icebreaker, writing, grouping, voting, discussion, actions, roti; skippable; back with confirmation — PhaseStepper, all ScreenRetro*.
- Live session settings with deferred application, undo, co-facilitator conflicts — SessionSettingsPopover.
- Per-phase timers; "lock at end" option — Timer, ScreenSessionCreate.
- Board lock, card focus, reveal cards, masked payloads, "n/m have written" — FacilitatorBar, RetroCard, ScreenRetroWriting.
- Per-card emoji reactions (persisted) vs ephemeral room reactions — RetroCard, ReactionBar.
- Groups: create / rename / dissolve, duplicate detection + auto-group, undo last group — CardGroup, ScreenRetroGrouping.
- Voting: budget, max per card, hidden totals, "finished voting", reveal votes — VoteDots, ScreenRetroVote.
- Discussion: topics ordered by votes, discussed flag, per-topic timer, "everyone follows" focus, collaborative notes per topic — ScreenRetroDiscussion.
- Actions phase: quick add linked to topic, create Jira ticket, export to Jira, undo — ScreenRetroActions.
- ROTI: anonymous vote, who-voted list, nudge, reveal, close; trend per sprint with quartiles — ROTIWidget, ScreenRetroROTI, MoodTrendChart.
- Health check: team statements (6 built-in + custom), snapshot, aggregates, trend, alert; `POST /retros/{id}/health-check` — HealthCheck, ScreenTeam, ScreenRetroROTI.
- Attach a survey / quick poll / health check mid-session — SessionSettingsPopover.
- End session + session-end page: duration, participation, stats, export PDF / CSV / Markdown / Jira, e-mail recap — ScreenRetroROTI, Emails.
- Retro summary page for closed retros — ScreenTeam.
- Templates: built-in catalogue, workspace / team / personal visibility, team default, usage counts, version conflicts — RetroTemplatePicker, TemplateEditor, ScreenWorkspace.

**Poker**
- Votes endpoint `POST /poker/{id}/votes`, reveal, revote, rounds history, accept estimate, next story, auto-reveal, watch-only facilitator, observers, timer per task, change vote after reveal — PokerCard, PokerTable, ScreenPoker*, ScreenSessionCreate.
- Tasks: add, edit, delete, reorder, Jira JQL import, description + acceptance criteria, write estimate to Jira/Linear field — ScreenPokerQueue, ScreenSessionCreate, PokerTable.
- Estimation history page (filters, pagination, CSV) and Saved decks page (built-in / custom, default, usage) — ScreenPokerQueue, DeckPicker.
- Similar stories with average points — MobilePoker.
- Poker and whiteboard workspace templates — ScreenWorkspace.

**Whiteboard**
- Rename, export, share, comments, convert stickies to actions, follow a user, read mode on mobile, whiteboard templates ("save as template"), thumbnails — ScreenWhiteboard, MobileRituals, ScreenWorkspace, ScreenTeam.

**Icebreakers / games**
- Games page `/teams/{team}/games`: named rooms, statuses, leaderboard 30 d / all time — GamesLeaderboard.
- Game engines: hangman, Pictionary (server-side fuzzy match), emoji puzzle (hint penalties), sprint-in-one-GIF (pick / vote / winner, pin to retro, gallery link), plus two truths, mood weather, guess who, quick question listed — ScreenIcebreaker*, GamesLeaderboard.
- GIPHY proxy `GET /api/gifs/search` and `/api/gifs/trending`, admin GIPHY settings — GifPicker.

**Surveys**
- Builder with 5 question types, autosave, publish, anonymity modes, close date, threshold, guest answering; results with CSV export, share, compare to previous sprint, send to whiteboard — ScreenSurvey, SurveyQuestion.

**Actions**
- Status todo / doing / done, priority, due, owner, source (retro / whiteboard / survey), ticket (Jira / Linear) with webhook sync; grouping by sprint / team / owner; facets; bulk update; bulk sync; export; manual creation; sprint entity with dates — ActionItem, ScreenActions, Table.
- Overdue reminder e-mail with one-click unsubscribe — Emails.

**Instance administration**
- Sections: General, Branding (logo, name, primary colour with contrast guard, radius, avatar style + member choice), SSO/OIDC (test connection), SMTP (test e-mail), Integrations (Slack, Jira, Linear, GIPHY), MCP keys with scopes, Licence (edition, seats, expiry), Users, Audit log — ScreenSettings, AvatarStylePicker, GifPicker.
- Instance version / up-to-date check, instance status and help links, maintenance message — ScreenErrors, ScreenAuth, ScreenSettings. Backups status — MobileDashboard.
- "About / Licences" page with DiceBear attributions — AvatarStylePicker.
- `BrandPalette::toHex()` for e-mails; white-label sender; "Powered by Skrüm" toggle — Emails.

**Landing / marketing**
- Public landing content, pricing plans and plan limits, docs / changelog / status / legal links — ScreenLanding (placeholders per its README).

---

## 5. Contradictions and gaps

### Between READMEs
1. **Phase id**: `discussion` (PhaseStepper) vs `discussing` (SessionSettingsPopover, RetroTemplate/TemplateEditor timers).
2. **Session type id**: `poll` (SessionTypePicker, Card/SessionCard) vs `survey` (GuestJoin, ShareDialog, EmptyState module). GuestJoin's kind list also omits `icebreaker`.
3. **Game ids**: IcebreakerGameCard `hangman|pictionary|emoji|two-truths` vs GamesLeaderboard `hangman|emoji|draw|two-truths|mood|who|quick-question`; neither includes the GIF game from ScreenIcebreakerGif.
4. **Whiteboard channel and whisper names**: `presence-board.{id}` + `client-pointer` (ExcalidrawTheme, ReactionBar) vs `presence-whiteboard.{boardId}` + `client-cursor` (LiveCursor, WhiteboardToolbar).
5. **Whiteboard shortcuts**: post-it = `N` and shape = `R` (WhiteboardToolbar) vs post-it = `N`, shape = `S` (KeyboardShortcuts) vs native Excalidraw keys 1–9/R/D/O/A (ExcalidrawTheme). WhiteboardToolbar also describes a custom tool set (sticky, connector, minimap) while ExcalidrawTheme says the native Excalidraw UI is kept and WhiteboardToolbar is only a fallback colour bar.
6. **Vote channel**: `private-retro.{sessionId}.votes` (VoteDots) vs `presence-retro.{sessionId}` everywhere else.
7. **Presence colour ownership**: assigned by the server, lowest free index, per session (PresenceStack, Avatar) vs chosen by the guest (GuestJoin) vs chosen by the user in profile (ScreenUserSettings).
8. **Column count**: max 6 columns (RetroColumn) vs 1–8 columns (TemplateEditor).
9. **Deck size**: "no more than 12 cards per deck" and Fibonacci `0…21` (PokerCard) vs built-in Fibonacci of 13 cards up to 89 and "2 to 20 values" (DeckPicker). T-shirt is `XS–XL` (PokerCard), `XS–XXL ?` (DeckPicker).
10. **Consensus rule**: agreement ≥ 0.75 and spread ≤ 1 step (PokerTable) vs "share of votes on the mode; beyond 2 steps show dispersion" (ScreenPokerAfter). Centre of table shows the mean (PokerTable) vs the median (ScreenPokerAfter).
11. **Vote removal and dots**: "−" button, full dot = available (VoteDots) vs "re-click a VoteDot to remove" and "5 dots, 3 full, 2 votes remaining" (ScreenRetroVote).
12. **Drawer deck grid**: 5 columns (Drawer) vs 4×3 (MobilePoker).
13. **Mobile tab bar**: Accueil, Sessions, Actions, Moral, Plus (Sidebar) vs 4 entries Accueil, Sessions, Actions, Équipe (MobileDashboard README).
14. **Second sidebar**: "Pas de seconde sidebar" (Sidebar, ScreenSecurity) vs "Sidebar admin dédiée" (ScreenSettings README).
15. **Session-type icons**: SessionTypePicker fixes `layers` / `sparkles` and itself notes ScreenSessionCreate "encore à aligner" (`sticky-note` / `party-popper`).
16. **InputOTP slot size**: `h-11 w-10` (InputOTP) vs `size-11 h-13` (ScreenSecurity).
17. **Notification kinds**: 5 kinds in NotificationsPanel vs 6 different events in ScreenUserSettings (assigned, due tomorrow, estimate saved, weekly digest have no panel kind; team invite, overdue, recap ready have no preference row).
18. **Two token systems**: personal tokens `skr_pat_…` with scopes `retros:* actions:* poker:read mcp` (ScreenUserSettings) vs instance MCP keys `skr_live_…` with scopes `actions:* sessions:read surveys:read *` (ScreenSettings).
19. **Timer increments**: +1 min (FacilitatorBar, Timer) vs "+2 min" (ScreenRetroWriting/Vote/Grouping READMEs).
20. **ScreenIcebreaker README** lists emoji reactions in the right column and `sk-react` in its component list, then its own "Réactions" section says reactions go only through ReactionBar.
21. **Shortcut collisions not addressed**: digits 1–6 (ReactionBar) vs 1–5 (ROTIWidget, HealthCheck, SurveyQuestion); only the poker conflict is handled. `N` = new card (retro), next task (poker), post-it (whiteboard); `R` = reveal (FacilitatorBar and poker) and shape (whiteboard); `T` = timer and text; `C` = coffee and connector.

### README vs its own preview
22. **ScreenTeam**: README describes the old sidebar (workspace selector, Platform → Teams sub-list, "Action items (7)"); preview uses the unified sidebar with "2 overdue".
23. **ScreenDashboard**: README nav omits Jeux and names a "Modèles" group; preview shows the full unified sidebar (Jeux, Espace de travail group, Administration).
24. **ScreenSettings**: README omits the avatar-style picker shown in the Branding preview; GIPHY integration (GifPicker) is absent from the Integrations preview.
25. **ScreenSessionCreate**: README says retro `sticky-note` and icebreaker `party-popper`; the preview dialog uses `layers` and `sparkles` (the list behind still uses `sticky-note`).
26. **ScreenRetroActions**: preview FacilitatorBar offers "Clôturer la rétro" at phase 6 while the stepper still shows phase 7 ROTI; ScreenRetroROTI ends the session with "Terminer la session".
27. **ScreenRetroWriting / Vote / Actions** previews have no ReactionBar, no settings icon and a text "Partager" button, while Grouping / Discussion / ROTI have ReactionBar, settings icon, back button and icon-only share. ReactionBar README says it is present in every live session.
28. **FacilitatorBar** props cover reveal / lock / focus / timer / next phase only; previews add Pause, anonymity toggle, votes-per-person, reveal votes, undo last group, everyone follows, nudge, reveal ROTI, end session, next topic, close retro.
29. **ScreenWhiteboard** preview shows a fully custom whiteboard (frames, connectors, comments, minimap, "Post-it (S)") while ExcalidrawTheme (and "A free canvas, Excalidraw" in ScreenOnboarding) say the board is Excalidraw with its native toolbar.
30. **MobileDashboard** preview shows "Phase 2 sur 5 · Vote" against a 7-phase model where Vote is phase 4; ScreenLanding's preview stepper shows only 3 phases.
31. **MobilePoker**: header says Fibonacci but the drawer deck contains ½ and 40 (modified Fibonacci).
32. **PokerCard** says the value is not in the DOM before reveal; the ScreenPokerBefore mockup carries values on face-down cards (mockup artefact, but do not copy the markup).
33. **ScreenIcebreaker** preview lists six games (hangman, two truths, mood weather, guess who, sprint in emojis, quick question) with no Pictionary or GIF game, and frames the room as a retro phase (breadcrumb Atlas › Rétro sprint 42 › Icebreaker); Draw / Emoji / GIF screens are standalone rooms under "Atlas · Games".
34. **ScreenUserSettings** profile has no DiceBear style grid although AvatarStylePicker says it appears in user Profile; no "Accessibility" section although KeyboardShortcuts refers to one; no week-start setting although DatePicker refers to Appearance.
35. **Game icon**: sidebar "Jeux" uses `party-popper`; ScreenTeam's Games button uses `gamepad-2`; onboarding uses `dices`; mobile uses `puzzle`.

### Referenced but no README (or no mockup)
- UI pieces defined only inside another README: `SessionCard`, `StatCard` (Card); `ColumnColorPicker` (TemplateEditor); `DeckEditor` (DeckPicker); `Alert` (Sonner); `Combobox` (Select); `EditingIndicator` (ConnectionState); `CursorLayer` (LiveCursor); `BoardSkeleton` / `ListSkeleton` (Skeleton); `VoteDrawer` / `ReactionDrawer` (Drawer); `ActionSheet` (Sheet); `ReactionPicker` (Popover).
- Named by screens with no README at all: `Field`, `Radio`, `Kbd`, `ScrollArea`, `Separator`; bundle-only classes `sk-sticky`, `sk-dist`, `sk-stat`, `sk-ticket`, `sk-prio`, `sk-due`, `sk-letter`, `sk-key`, `sk-minimap`, `sk-subnav`, `sk-team-switch`, `sk-trema`, `sk-scale`, `sk-result`; faceted filter and bulk bar (`.ac-filter`, `.ac-bulk`); confetti.
- No component README for the game UIs themselves (hangman, Pictionary canvas, emoji puzzle, GIF gallery), the survey builder, the whiteboard comments panel, or the discussion-notes editor — they exist only as screens.
- No mockup for: Sessions index (only a backdrop), Mood & ROTI page, Members page, 2FA challenge at login, e-mail verification, password reset, admin General / Users / Audit log, team settings tabs Général / Intégrations / Données & export, `/join` code entry (desktop), retro "Summary" page, instance "About / Licences".
- Files referenced but absent from `docs/design-system/`: `tools/sidebar.py`, `tools/palette.py` (ScreenSecurity, Emails); `bundle.css` is present as `_preview-bundle.css`. `App\Support\Branding\BrandPalette` is referenced by Emails; a copy lives at `docs/design-system/php/BrandPalette.php` and there is no `app/Support/Branding/` yet.
