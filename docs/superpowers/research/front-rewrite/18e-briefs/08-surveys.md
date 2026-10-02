# Brief 08 — SURVEYS (inside the retro board)

Read-only research. Nothing verified by running code. Sources read: spec §4-§10, inventory-pages.md §"1. Surveys" (l.1873-1919, 2124-2129), inventory-components.md (survey rows), notes-for-18e.md, ScreenSurvey + SurveyQuestion + MobileRituals + SessionSettingsPopover READMEs, `skrum/survey-question.tsx` (full), old survey files, `lib/retro/survey-api.ts`, reducer/hook slices, Plan08c/08d/08e browser tests.

## 1. Scope

- **No page, no route.** Surveys live in `retros/show` (SessionLayout), served by `RetroSnapshotsController` (`snapshot.surveys: SurveyPayload[]`), and in the completed results (`snapshot.results.surveys`). Back-end routes (all kept): `retros.surveys.{store,show,update,destroy}`, `.closure.{update,destroy}`, `.response.{update,destroy}`, `.reactions.{update,destroy}`, `.comments.store`, `retros.survey-comments.{update,destroy}`, `retros.survey-drafts.store`.
- Mockups: ScreenSurvey (b "answer" and c "results" cards are the visual reference; a "builder" is mostly backlog), MobileRituals survey phone (card full width, 44px targets; the one-question-per-screen flow is backlog), SurveyQuestion README, SessionSettingsPopover README ("Add survey" entry).
- Spec §7 row 8 "Surveys inside the retro | ScreenSurvey | SurveyQuestion | Session". New component already built: `components/skrum/survey-question.tsx` (+ test, + dev bench section).
- **Plugs into the retro board (exact slots)**, all owned by the retro group's `RetroBoard` container (old `retro/board.tsx`), which must be written first:
  1. **Columns scroller**: `<SurveysColumn />` is the FIRST child of the horizontal scroller that holds the columns (old: first child of `<main>` in `board.tsx:316`, before `board.columns.map`). It reads `useBoard()` and renders `null` unless phase is in `SurveyPhases` and `board.surveys.length > 0`.
  2. **"Add survey" entry**: the `onAddSurvey` prop of `SessionSettingsPopover` (rendered by the retro FacilitatorBar settings icon; popover README: outline full-width button, `ClipboardList` icon, hidden when `readOnly` or when `onAddSurvey` is undefined). The retro container passes `onAddSurvey={surveyEditor.openCreate}` only when `viewer.isFacilitator && SurveyPhases.includes(phase) && isEditable && surveys.length < MaxSurveys` (same rule as old `AddSurveyButton`), and mounts `<SurveyEditorDialog />` ONCE beside the popover (outside the popover content so it survives the popover closing).
  3. **Completed results**: the "Surveys" `ResultsSection` of the session-end screen renders `<SurveyResultList surveys={results.surveys} />`.
- **Order relative to the retro group: AFTER, never before.** The retro commit runs first and, to stay green, must (a) keep `components/retro/board-context.tsx` (`useBoard`, `run`, `apply`, `dispatch`, `invalidateSurvey`, `handleError`, `sessionExpired`, `isEditable`) with its current API, (b) keep `comment-thread.tsx` and `reaction-chips.tsx` (+ `emoji-picker.tsx`) with their current exports (restyled in place; they are shared with card comments/reactions), (c) KEEP the six old `survey-*.tsx` / `surveys-column.tsx` files and `results/survey-result.tsx` and mount them in the new container at the three slots above (old `SurveysColumn`, old `SurveyDialog` opened by `onAddSurvey`, old `SurveyResult` in the results section). The surveys commit then swaps those three mounts and deletes the old files. If the retro commit deletes any of (a)-(c) the surveys group cannot compile. Tell the retro-group author.
- Layout: SessionLayout (retro). Guests included (they answer, react, comment).

## 2. Commits (2, after the retro group's last commit)

| # | Commit | Deletes |
|---|---|---|
| S1 | `feat(retro-surveys): surveys column, answer and results cards, editor dialog and AI draft on SurveyQuestion` — adds `components/retro/surveys/*`, `lib/retro/survey-question-adapter.ts` (+ Vitest), small `SurveyQuestion` interface fixes (§9 gaps G1-G4), swaps the 2 board mounts (column, add-survey), tests updated | `components/retro/surveys-column.tsx`, `survey-card.tsx`, `survey-menu.tsx`, `survey-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx` |
| S2 | `feat(retro-surveys): surveys in the completed results` — `SurveyResultList` mounted in the results section; Plan08d-04c and Plan08c-07 results part updated | `components/retro/results/survey-result.tsx` |

(S1/S2 may be one commit; they are split only because the results screen belongs to the retro group's results commit. If the retro results commit already mounts old `SurveyResult`, S2 swaps it.) `lib/retro/survey-api.ts`, reducer actions `survey.*`, `use-retro-board` / `use-retro-channel` survey wiring, `lib/retro/types.ts` survey types are KEPT unchanged.

## 3. Parity table (from inventory-pages §1 + old files)

New files are under `resources/js/components/retro/surveys/` unless noted. "SQ" = `skrum/survey-question.tsx`.

| # | Action / behaviour | Old control (file) | Route / event | New component and control | Browser hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Open "New survey" dialog | "Add survey" button, `surveys-column.tsx` `AddSurveyButton` (header) | client | `SessionSettingsPopover` `onAddSurvey` button "Add survey" -> `SurveyEditorDialog` (create) | accessible name "Add survey"; dialog title "New survey" | **Test changes**: Plan08c/08e call `click('Add survey')` straight from the board; now they must first open the settings popover (Decision D2). Entry hidden for non-facilitator, wrong phase, locked, 10 surveys |
| 2 | Dialog forced closed on session expiry | `open && !ctx.sessionExpired` | — | same condition in `SurveyEditorDialog` and delete confirm | — | keep |
| 3 | Pick answer type | `Select #survey-kind` single/multiple/text (`survey-dialog.tsx`) | — | `ui/select` in the dialog, same id and 3 items (labels "Single choice", "Multiple choice", "Free text"). Do NOT offer scale5/NPS (no back end) | `#survey-kind`, `[role="option"]:has-text("Multiple choice")`, `"Free text"` | `SurveyKindLabels` keys must stay as translated strings via literal `t('…')` (TranslationKeysTest) |
| 4 | Write question / description | `#survey-question` (<=200, required), `#survey-description` (<=500) | — | `ui/input`, `ui/textarea`, same ids and limits | `#survey-question`, `#survey-description` | |
| 5 | Options add / remove (2..10) | inputs `aria-label="Option n"`, `Remove option n`, "Add option" | — | same controls composed from `ui/input` + `ui/button` (ghost icon `X`, outline `Plus`); no drag handle (reorder not backed) | `[aria-label="Option 1"]`, `Add option`, `Remove option n` | hidden for kind `text`; remove disabled at 2; add disabled at 10 |
| 6 | "Show who answered" at creation | `Checkbox #survey-show-voters` + note | `show_voters` in body | keep `ui/checkbox` with `#survey-show-voters`, disabled on anonymous retro + note "Names are never shown on anonymous retros." | `#survey-show-voters`, `aria-checked`, the note text | Mockup anonymity radio (3 modes) is backlog; do not switch to `Switch` (would not break the test but no mockup demands it) |
| 7 | AI draft | `SurveyDraftField`: `#survey-draft-prompt`, "Generate", Enter key, disclosure line | `POST retros/{retro}/survey-drafts` `retros.survey-drafts.store` | `SurveyDraftField` rebuilt: dashed box, `ui/input` + `ui/button variant=secondary` with `Sparkles`; only on create and only if `features.llm`; Enter generates; inline error | `#survey-draft-prompt`, text "Generate from a prompt", "Your prompt and the retro title are sent to :provider.", button "Generate" | Plan08e-02a/05a/05b unchanged |
| 8 | Save create | submit "Save" | `POST retros/{retro}/surveys` `retros.surveys.store` body `{kind, question, description\|null, options[], show_voters}` | `FormDialog` (skrum/confirm-dialog) or `ui/dialog` with a submit button "Save"; on success `ctx.invalidateSurvey` + `ctx.apply({type:'survey.upsert'})`; on error inline `error`; expired session -> close | `[role="dialog"] button[type="submit"]` | `FormDialog.onSubmit(data, formData)` ignore FormData (state is controlled). Verify the dialog holds a tall form (default size 32rem; `size="sm"` is too narrow) |
| 9 | Edit survey | menu "Edit survey" -> same dialog prefilled, no AI | `PATCH retros/{retro}/surveys/{survey}` `retros.surveys.update` | `SurveyActionsMenu` item "Edit survey" (disabled when `responseCount>0` or `!canEdit`) + hint "Edit is only possible before the first answer." | item text "Edit survey" | |
| 10 | Toggle "Show who answered" | `DropdownMenuCheckboxItem` | `PATCH …/surveys/{survey}` body `{show_voters}` | same `DropdownMenuCheckboxItem` in `SurveyActionsMenu` | `[role="menuitemcheckbox"]`, `aria-checked`, `aria-disabled` on anonymous | not blocked by lock (server) |
| 11 | Close / reopen | menu item "Close survey"/"Reopen survey" | `PUT`/`DELETE …/surveys/{survey}/closure` | same items | texts "Close survey", "Reopen survey" | works on locked board |
| 12 | Delete survey + confirm | item "Delete survey" (destructive) + Dialog "Delete this survey?" | `DELETE …/surveys/{survey}` then `survey.remove` | item with `variant="destructive"` + `ConfirmDialog tone="destructive"`, description "Its answers, reactions and comments are deleted too.", confirm "Delete" | texts | disabled unless `canEdit` |
| 13 | Menu trigger | `Button aria-label="Survey actions"` | — | trigger composed from `ui/dropdown-menu` + ghost icon button `Ellipsis`, passed to SQ `actions` slot (header, `ms-auto`) | `[aria-label="Survey actions"]` | rendered only for facilitator and phase != completed; absent for guests/members and in results |
| 14 | Answer single choice (one click) | option `Button aria-pressed` | `PUT …/surveys/{survey}/response` `{optionId}` | SQ `kind="single"` radiogroup; `onChange(optionId)` sends at once (keep immediate submit) | **changes**: `button[aria-pressed]` -> `input[type=radio]` | Test change imposed by SurveyQuestion README (radiogroup). Re-selecting the checked radio fires no change (old re-sent the same answer: harmless) |
| 15 | Answer multiple choice | checkboxes + "Submit"/"Update answer" (disabled when empty/unchanged) | same, `{optionIds}` ordered by option position | SQ `kind="multiple"` (`Checkbox` role=checkbox inside `label`), local `value: string[]`, `onSubmit`; `canSubmit` rule in container: non-empty AND changed | `button[role="checkbox"]`, button "Submit"/"Update answer" | SQ enables Submit when non-empty only: **gap G3** (disable when unchanged, test P08c-02b asserts disabled "Update answer") |
| 16 | Answer free text | textarea <=500 + Submit/Update | same, `{text}` (trimmed) | SQ `kind="text"`, `maxLength=500`, `onSubmit` | text "Submit"/"Update answer" | **Test change**: input is found by `aria-labelledby` (question) not `aria-label="Your answer"`. Same unchanged-disable rule (G3) |
| 17 | Withdraw my answer | link button, when `canAnswer && hasAnswered` | `DELETE …/response` | SQ `onWithdraw` + `hasAnswered`, passed only when answerable | "Withdraw my answer" | |
| 18 | Remount inputs when server answer changes | `key={myOptionIds.join()}` / `key={myText}` | — | `SurveyBoardCard` keeps local draft state in a child keyed the same way | — | prevents stale checkbox/text after a refetch |
| 19 | Closed badge + disabled answering | `Badge "Closed"`, buttons disabled | — | SQ `closed={survey.isClosed}` (badge + disabled controls). Not answerable for another reason (locked board, phase) -> SQ disabled (**gap G1**: add `disabled?: boolean`) | text "Closed" | closed => `resultsVisible` true |
| 20 | "Several answers allowed" | line under the title | — | SQ badge `kindLabels.multiple` ("Several answers allowed") | text | |
| 21 | Description under title | `<p>` | — | SQ `description` | text | |
| 22 | Response count | "1 response" / ":count responses" | — | SQ footer count (needs `results` object even when hidden: pass `{responses, hidden:true}`) | "0 responses", "1 response", ":count responses" | |
| 23 | Results hidden until answered/closed | `resultsVisible` false: no bars | payload `options[].count=null`, `textAnswers=null` | `results={{responses, hidden: !resultsVisible}}`; in answer mode SQ shows nothing but the count when hidden | assertion `innerText.includes('%')` false | privacy rule (inventory l.1879): never fabricate counts client-side |
| 24 | Option results `% · count` | `OptionResult` bar + text | — | SQ `CountResults` (`data-slot="survey-result"`); single: `"100% · 1"`; **multiple: `"1 · 100%"`** | `li:has-text` + text | **Test change**: multiple format imposed by SQ README ("choix multiple en nombre"); bar selector `li div.bg-primary` -> `[data-slot="survey-result-bar"] > div` (P08d-04c) |
| 25 | Voter avatars (when `showVoters`) | `img[alt=name]` + tooltip of names | `options[].voters` ids | SQ option `voters` via adapter (ids -> `board.participants`); **gap G2**: SQ `Voters` renders `PersonAvatar` without `imgProps={{alt: name}}` so `alt=""` today | `img[alt="Alice Martin"]` in the option `li` | must pass `alt`; tooltip of names optional (not required by suite) |
| 26 | Text answers list | `ul[aria-label="Answers"]`, own answer "Your answer", author name when shown, "No answers yet." | `textAnswers`, `authorId` | SQ `TextResults` (`aria-label` "Answers", `isMine`, `authorName` from `participants`), shows 5 then "See :count more" | `ul[aria-label="Answers"] li`, `answer.firstChild.textContent` | server sorts by text; keep order. New collapse at 5 answers: P08c tests have <=2 |
| 27 | Reactions on a survey (optimistic) | `ReactionChips` + emoji picker, only if `retro.reactionsEnabled` | `PUT`/`DELETE …/reactions` `{emoji}` | `SurveyDiscussion` in SQ `footer`, reusing the retro group's reaction chips (`reaction-chips.tsx` kept, restyled) and `optimisticReactions` | `[aria-label="Add a reaction"]`, `[aria-label="🎉, 1 reaction"]` (`aria-pressed`), menu item `[role="menuitem"]:has-text("🎉")` | enabled only when `canDiscuss` |
| 28 | Comments toggle + count | `Button aria-label="Comments (n)"` `aria-expanded` | — | same button in the footer | `button[aria-label="Comments (1)"]`, `^="Comments"` | |
| 29 | Hidden-results discussion line | "n · Answer to join the discussion" with icon | — | same line in the footer when `!resultsVisible` (SQ results-mode text "Results are not visible yet." is NOT used on the board) | text `1 · Answer to join the discussion` | |
| 30 | Add/reply/edit/delete comment | `CommentThreadList` + `CommentForm` (Enter submits) | `POST …/surveys/{survey}/comments`; `PATCH`/`DELETE retros/{retro}/survey-comments/{surveyComment}` | same `CommentThreadList<SurveyComment>` (retro group restyle), same `actions` object, refetch via `fetchSurvey` after each write | `[aria-label="Write a comment…"]`, composer Enter, `composerNote` "Your name is shown with your comment." | delete: author or facilitator |
| 31 | Refetch one survey | `fetchSurvey` | `GET retros/{retro}/surveys/{survey}` | `lib/retro/survey-api.ts` unchanged | — | |
| 32 | Realtime counts / refetch / remove | `use-retro-board` | `.survey.changed`, `.survey.deleted`, `.survey.discussion.changed`, `.own-survey-comment.saved`, `.comment.notification` | unchanged hook; UI re-renders from `board.surveys` | `[data-realtime]` on retro root (retro group) | §5 |
| 33 | Notification toast "New comment on your survey" | hook | `.comment.notification` | unchanged | — | |
| 34 | Surveys column heading and landmark | `section[aria-label="Surveys"]` + `h2 "Surveys"` | — | `SurveysColumn` composed `<section aria-label=t('Surveys')>` with `h2`; each card is the SQ `<article>` | `section[aria-label="Surveys"] article` count | see G4: SQ article needs `aria-label`/rest props |
| 35 | Card landmark by question | `article[aria-label=question]` | — | SQ `article` + `aria-label={survey.question}` (**gap G4**: SQ has no rest props; `aria-labelledby` alone does not match `[aria-label=…]`) | `article[aria-label="…"]` (used ~60 times in Plan08c/d) | |
| 36 | Results tab (completed): read-only survey list | `results/survey-result.tsx` | `results.surveys` | `SurveyResultList`: SQ `mode="results"`, `closed`, no menu, no inputs, discussion footer read-only (threads expandable, no reactions/composer) | `section:has(h2:has-text("Surveys")) article`; "No answers yet."; `[aria-label="Survey actions"]` absent | |
| 37 | Max 10 surveys | `MaxSurveys` | server 422 | same constant | — | |
| 38 | Digit shortcuts 1-5 | none (new in SQ) | — | SQ `onKeyDown` digit on single-choice answers inside the card | — | new behaviour; see risk R3 |

## 4. Composition

Folder: `resources/js/components/retro/surveys/` (subfolder of the existing retro domain, like `results/`, `insights/`; no new base folder).

| File | Role | Uses |
|---|---|---|
| `surveys-column.tsx` | `SurveysColumn` (section, h2, list of `SurveyBoardCard`, empty/phase guard) | `useBoard`, `SurveyPhases`, plain Tailwind section styled from neighbours (RetroColumn is NOT reused: it carries rename/colour/sort menu, `id`, `onAdd`) |
| `survey-board-card.tsx` | one survey on the board: computes `canAnswer`, local draft, calls `retroRequest(SurveyResponsesController.update/destroy)` with the old `send()` guard (`busy`, `ctx.run`, `invalidateSurvey`, `apply`) | `SurveyQuestion`, `SurveyActionsMenu` (as `actions`), `SurveyDiscussion` (as `footer`) |
| `survey-actions-menu.tsx` | facilitator menu (rows 9-13) + `ConfirmDialog` | `ui/dropdown-menu`, `skrum/confirm-dialog` |
| `survey-editor-dialog.tsx` | create/edit dialog (rows 3-8), `useSurveyEditor()` hook exposes `{open, survey, openCreate, openEdit, close}`; state `SurveyDraft` kept | `FormDialog` or `ui/dialog`, `ui/select`, `ui/input`, `ui/textarea`, `ui/checkbox`, `ui/button` |
| `survey-draft-field.tsx` | AI prompt box (row 7) | `ui/input`, `ui/button`, `ui/label`, `InputError` (existing) |
| `survey-discussion.tsx` | reactions + comments toggle + thread (rows 27-30, 29) | retro `reaction-chips.tsx` / emoji picker, `comment-thread.tsx`, `ui/button` |
| `survey-result-list.tsx` | completed results (row 36), imports `SurveyBoardCard`'s adapter, `mode="results"` | `SurveyQuestion` |
| `resources/js/lib/retro/survey-question-adapter.ts` (+ `.test.ts`) | pure functions below | — |

**Composed from primitives (no dedicated component):** the surveys column, the editor dialog (the mockup's builder "selected question" card is the visual reference: type select, label, option rows), the AI draft box, the actions menu, the discussion footer, the result list wrapper.

**Adapter `SurveyPayload` -> `SurveyQuestionProps` (field by field):**

| SQ prop | From |
|---|---|
| `id` | `survey.id` |
| `kind` | `survey.kind` (`single`/`multiple`/`text`; `scale5`/`nps` never produced) |
| `label` | `survey.question` |
| `description` | `survey.description` |
| `mode` | board: `'answer'`; results list: `'results'` |
| `options` | `survey.options.map(o => ({id, label, count: o.count, voters: o.voters?.map(id => participantById(id)).filter(Boolean).map(p => ({id: p.id, name: p.name, avatarUrl: p.avatarUrl}))}))` (voters null stays null) |
| `value` | single: `selected[0] ?? null`; multiple: local `string[]`; text: local string (init `myOptionIds` / `myText ?? ''`) |
| `hasAnswered` | `myOptionIds.length > 0 \|\| myText !== null` |
| `closed` | `survey.isClosed` |
| `disabled` (G1) | `!canAnswer \|\| busy` where `canAnswer = ctx.isEditable && !isClosed && SurveyPhases.includes(phase)` |
| `anonymous` | `!survey.showVoters` (Decision D3) |
| `maxLength` | 500 (text) |
| `results` | `{responses: responseCount, hidden: !resultsVisible, textAnswers: survey.textAnswers?.map(a => ({id, text, isMine, authorName: a.authorId ? participantName : null}))}`; `undefined` textAnswers when null |
| `onChange` | single: send `{optionId}` immediately; multiple/text: update local draft |
| `onSubmit` | multiple `{optionIds}` in option order; text `{text: trimmed}` |
| `onWithdraw` | `DELETE response`, passed only if `canAnswer` |
| `actions` | `<SurveyActionsMenu/>` (facilitator, phase != completed) |
| `footer` | `<SurveyDiscussion/>` |
| `aria-label`, `data-test` (G4) | `survey.question` |
| not passed | `index`, `count` (one card per survey, no sequence), `required`, `maxChoices`, `scaleLabels`, `invalid` (no back end) |

Reused as-is: `lib/retro/survey-api.ts`, `retroRequest`, `Survey*Controller` action imports, reducer `survey.*`, `useBoard()` context, `optimisticReactions`, `fetchSurvey`.

## 5. Realtime

Channel hook `useRetroChannel` (presence `retro.{id}`, private `participant.{id}`) is unchanged and lives in the retro group's `useRetroBoard`. Events landing on surveys:

| Event | Hook behaviour (unchanged) | Where it shows in the new tree |
|---|---|---|
| `.survey.changed {surveyId, version, responseCount}` | `survey.counts` now; debounced 1 s refetch if unknown/version differs/`resultsVisible` | `SurveysColumn` list and `SurveyBoardCard` (count line, bars) |
| `.survey.deleted` | cancel refetch + `survey.remove` | card disappears; column unmounts at 0 |
| `.survey.discussion.changed {surveyId, commentCount}` | `survey.counts`; refetch if `resultsVisible` | footer comment count / threads / reaction chips |
| `.own-survey-comment.saved` (private) | schedule refetch | footer threads of the author's other tab |
| `.comment.notification` | toast "New comment on your survey" / "New reply…" | sonner (retro group) |

Two-browser contract that must keep working (Plan08c): create by facilitator appears for a guest without reload; an answer by A updates counts for B, results stay hidden for B until B answers; close/reopen toggles "Closed" and disabled state for others; withdraw hides results again; stale-response protection (`invalidateSurvey` after every own mutation) must still be called. No whispers involved. `key` on local draft state is needed so a remote-driven refetch does not leave stale inputs (row 18).

## 6. Mockup elements not rendered / without mockup

**Not rendered (spec §10 "survey builder extras" and unbacked):** multi-question survey with numbered list, drag reorder, Duplicate, per-question Required switch, scale 1-5 and NPS 0-10 kinds and their results (mean, NPS score, histogram), scale bound labels, autosave "brouillon", Aperçu / Publier, settings panel 340px (anonymity 3 modes, one question at a time, results after answer, guests toggle, close date / auto-close, display threshold), "Question n sur N" progress and Précédent/Suivant (mobile priority view), optional comment per question, results tabs Synthèse / Réponses libres / Comparer au sprint 41, CSV export, share to team, "Envoyer au whiteboard", keyword cloud and quotes (SQ supports them, container passes none), `maxChoices` ("3 max"), `ScreenSurvey` participant chrome (logo, guest avatar), survey on `presence-survey.{id}` channel, "hidden under 3 responses" threshold (server has none; spec notes say do not invent). SessionSettingsPopover menu "Health check / Quick poll / From a template" and "added after Actions, before ROTI" are not rendered: single "Add survey" button as the component implements.

**No mockup, designed from neighbours:** the surveys column on the board (section styled like RetroColumn's header/surface tokens, cards = SQ), the editor dialog (ScreenSurvey a "selected question" card + FormDialog), the AI draft box (dashed `Alert`-like block, `Sparkles` icon per iconography), the actions menu (CardMenu/column menu pattern), the discussion footer (RetroCard reactions + comments button), the delete confirm (ConfirmDialog). Mobile: single column; the card is full width, targets >=44px come from SQ; no wizard.

## 7. Back-end changes

None of spec §9 is specific to surveys. Dependency to flag (not planned): **B1** adds phases `actions` and `roti`; `SurveyGuard::activePhase` (`app/Actions/Surveys/SurveyGuard.php:15`, hard-coded list writing..discussing) and the front `SurveyPhases` must be reviewed by the retro/B1 plan; this brief assumes they stay unchanged (Decision D1). Gap to report: back end has only `single|multiple|text`; no scale/NPS/required/maxChoices.

## 8. Browser tests

Files: `tests/Browser/Walkthroughs/Plan08cSurveysTest.php` (P08c-01..07, ~20 helper selectors), `Plan08dResultsTest.php` ([P08d-04c] surveys in results, l.392-440), `Plan08eLlmTest.php` ([P08e-02a, 05a, 05b]; `p08eWithoutLlm`). Binding summary: `article[aria-label=Q]`, `section[aria-label="Surveys"]`, `button` inside option `li`, `button[role="checkbox"]`, `[aria-label="Your answer"]`, `ul[aria-label="Answers"] li`, `[aria-label="Survey actions"]`, `[role="menuitemcheckbox"]`, `[aria-label^="Comments"]`, `[aria-label="Add a reaction"]`, ids `#survey-kind #survey-question #survey-description #survey-show-voters #survey-draft-prompt`, `[aria-label="Option n"]`, texts "Add survey", "Close survey", "Reopen survey", "Withdraw my answer", "Submit", "Update answer", "N% · n", "n response(s)", "Answer to join the discussion".

**Tests that MUST change (cite):**
| Test | Change | Imposed by |
|---|---|---|
| P08c-01, 08e-02a/05a/05b | open settings popover before `click('Add survey')` (and close/handle the popover) | SessionSettingsPopover README (entry lives in the popover); spec §6.5 #27 |
| P08c-02a, 03, 04a/b, 05, 06, 07 | `{option} button` + `aria-pressed` -> radio input: click `label:has-text("Great")` / `input[type=radio]`, assert `:checked`; disabled assertions on `input[type=radio]` | SurveyQuestion README (radiogroup, role radio) |
| P08c-02b | `'100% · 1'` -> `'1 · 100%'` for multiple; keep `button[role="checkbox"]`; "Update answer" disabled needs G3 | SurveyQuestion README states ("choix multiple en nombre") |
| P08c-02c, 04a | text input `[aria-label="Your answer"]` -> `article textarea`; list selector unchanged | SQ text field labelled by the question |
| P08c-07 (reopen part), 03 | closed text survey: assert textarea disabled instead of absent `[aria-label="Your answer"]` | SQ keeps the field, disabled |
| P08d-04c | bar widths selector `li div.bg-primary` -> `[data-slot="survey-result-bar"] > div` (`bg-chart-1`); voters `img[alt]` needs G2 | SQ markup / ResultBar |
| All with `p08cCard` | unchanged only if G4 adds `aria-label` to the `article` | — |

**New tests** (ids `[P18e8-nn]`, in a new `Plan18eSurveysTest.php`, plus Vitest):
- [P18e8-01] settings popover shows "Add survey" only to the facilitator in writing..discussing, hidden for a guest and at 10 surveys.
- [P18e8-02] keyboard: digit 1-3 answers a single-choice survey inside the card and does NOT send a flying reaction (shortcut collision, spec §6.5 #21).
- [P18e8-03] radiogroup/checkbox group named by the question (a11y).
- [P18e8-04] 390px width: surveys column and an open comment thread do not overflow (covered by the visual overflow harness; add the surveys column fixture to the retro screen capture).
- Vitest: `survey-question-adapter.test.ts` (hidden results never produce counts, voters mapping, author names only when present, unchanged-answer rule); `survey-question.test.tsx` additions for G1-G4.

## 9. Risks and open questions

Gaps in the finished component (fix in S1, in `skrum/survey-question.tsx`, with its Vitest):
- **G1** no `disabled` prop: `closed` also shows the Closed badge; `busy` is semantically wrong for "locked board / wrong phase".
- **G2** `Voters` uses `PersonAvatar` without `imgProps`, giving `alt=""` (`ui/avatar.tsx:226`); the suite finds voters by `img[alt="Alice Martin"]`.
- **G3** Submit is enabled whenever the draft is non-empty; the old front disabled it when unchanged (P08c-02b "Update answer" disabled). Add `dirty`/`submitDisabled` or compare to a `savedValue` prop.
- **G4** no rest props: `article` only has `aria-labelledby`; add `...props` (`ComponentProps<'article'>`) like RetroColumn so `aria-label`, `data-test` pass.

Other risks:
- R1 Ordering/coupling with the retro group (section 1): old survey files import `board-context`, `comment-thread`, `reaction-chips`, `emoji-picker`, `results/survey-result`; breaking any in the retro commit breaks the build.
- R2 `SurveyQuestion` single-choice immediate submit: radios fire `onChange` on first selection only; a user cannot "confirm"; fine, but a mis-click on a digit key submits (see R3).
- R3 SQ handles digits 1-5 on keydown inside the card; the retro ReactionBar uses digits 1-6 through `useShortcut`. SQ calls `preventDefault`, and `useShortcut` ignores defaultPrevented, but only if the React handler runs before the window listener (React root listener: should); verify with [P18e8-02].
- R4 Anonymous retro: `showVoters` already false server-side; the new "Anonymous" badge would also show on non-anonymous retros where `show_voters` is off, while comments still show names ("Your name is shown with your comment." note). Misleading badge risk (D3).
- R5 Closed + results mode: the Closed badge appears in the completed Results tab (every survey auto-closed); P08c-07 does not forbid it.
- R6 `FormDialog` fits the editor? Not verified (size, scroll with 10 options). Fallback: `ui/dialog` directly.
- R7 Text answers collapse to 5 with "See :count more": new, no test; with 6+ answers the P08c `ul li` assertions would see 5.
- R8 Unverified: `ReactionPicker`/`reaction-chips` restyle by the retro group may change `[aria-label="Add a reaction"]` and chip names (suite binds ":emoji, :count reaction(s)"); I did not read the retro group's plan.
- R9 Dev bench: `pages/dev/sections/survey-question.tsx` already exists; keep it; add nothing for containers.

**Decisions needed (product owner):**
- D1 Surveys in the new `actions` and `roti` phases (B1): keep answerable only writing..discussing (assumed; server `SurveyGuard::activePhase` untouched), or extend to Actions/ROTI (needs a back-end change not in §9)?
- D2 "Add survey" entry point: only inside the settings popover (mockup; costs one click and changes 4 tests) or also a visible button on the board (keeps tests, deviates from mockup)?
- D3 Show the "Anonymous" badge on a survey when names are hidden (`!showVoters`)? Default proposed: yes.
- D4 Multiple-choice result format "n · p%" (mockup) instead of "p% · n" (old): accept the test change?

## 10. Size

- Containers/new files: 7 components + 1 adapter + 2 tests (adapter, SQ additions) = about 10 files; SQ edits (G1-G4) small.
- Old files deleted: 7 (`surveys-column`, `survey-card`, `survey-menu`, `survey-dialog`, `survey-draft-field`, `survey-discussion`, `results/survey-result`).
- Tests touched: 3 Pest files (Plan08c ~8 tests, Plan08d 1, Plan08e 3) + 1 new Pest file + 2 Vitest files.
- Lang: few or no new keys (all SQ strings, "Add survey", editor labels already exist in `lang/*.json`); add any new in all 4 files. Verify `TranslationKeysTest`.
- Parallelism: NOT parallel with the retro group (needs its board, popover and results mounts; edits `retro/board` container, results view, `use-retro-board` untouched). Shared files touched: the retro container mount lines, `skrum/survey-question.tsx` (no other group uses it), lang files. Can run in parallel with poker, games, whiteboard, workspace, settings, auth groups (no overlap), except lang files merge conflicts. Estimated 1 working session after retro.
