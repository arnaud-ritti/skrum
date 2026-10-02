# Group 8 — Surveys in the retro

## Task S1 — Surveys column, answer and results cards, editor dialog and AI draft

Nothing ran: no Pest, Vitest or browser test, no capture (owner decision). The table below is read from the code, not walked on a running page. The walkthroughs under `tests/Browser/Walkthroughs` were neither written nor edited (owner decision): `Plan18eSurveysTest.php` does not exist, and `Plan08cSurveysTest.php`, `Plan08dResultsTest.php` and `Plan08eLlmTest.php` still hold the old selectors listed in the task.

### Parity (brief 08 §3, rows 1–35, 37–38)

Files are under `resources/js/components/retro/surveys/` unless noted. "SQ" is `components/skrum/survey-question.tsx`.

| # | Action | New control | Done |
|---|---|---|---|
| 1 | Open "New survey" | "Add survey" of `SessionSettingsPopover` (`onAddSurvey`, from `board-settings.tsx`): facilitator, Writing to Discussing, board not locked, fewer than ten surveys. The panel closes and `SurveyEditorDialog` opens; a draft of the settings is kept | yes |
| 2 | Dialog closed when the session expires | `editor.open && !ctx.sessionExpired`; same on the delete confirmation | yes |
| 3 | Answer type | `Select` `#survey-kind`: "Single choice", "Multiple choice", "Free text" | yes |
| 4 | Question, description | `#survey-question` (200, required), `#survey-description` (500) | yes |
| 5 | Options, 2 to 10 | inputs "Option n", "Remove option n" (disabled at 2), "Add option" (disabled at 10); hidden for a text survey | yes |
| 6 | "Show who answered" at creation | a switch `#survey-show-voters` (PB-27), disabled on an anonymous retro with "Names are never shown on anonymous retros." | yes |
| 7 | AI draft | `SurveyDraftField`: dashed box, `#survey-draft-prompt`, "Generate", Enter generates, the disclosure line, the error under it; on creation only, and only with `features.llm` | yes |
| 8 | Save | `FormDialog`, submit "Save"; the server message stays in the dialog; an expired session closes it | yes |
| 9 | Edit a survey | "Edit survey" of `SurveyActionsMenu`, disabled after the first answer or when the board is locked, with "Edit is only possible before the first answer." | yes |
| 10 | Toggle "Show who answered" | `DropdownMenuCheckboxItem`, disabled on an anonymous retro | yes |
| 11 | Close, reopen | "Close survey" / "Reopen survey" | yes |
| 12 | Delete | "Delete survey" (destructive, with its icon) then `ConfirmDialog` "Delete this survey?" / "Delete" | yes |
| 13 | Menu trigger | ghost icon button "Survey actions" in the `actions` slot of SQ; facilitator only, not once completed | yes |
| 14 | Single choice in one click | radios of SQ; `onChange` sends `{ optionId }` at once | yes |
| 15 | Multiple choice | checkboxes of SQ, local draft, "Submit" / "Update answer" disabled when empty or unchanged (`submitDisabled`) | yes |
| 16 | Free text | textarea of SQ named by the question, 500 characters, the same rule | yes |
| 17 | Withdraw | "Withdraw my answer" (`onWithdraw` only when answering is possible) | yes |
| 18 | Stale inputs after a refetch | the draft starts again when `savedSurveyAnswerKey(survey)` changes; the open discussion is not remounted | yes |
| 19 | Closed, or not answerable | `closed` (badge and disabled controls); locked board or wrong phase: `disabled` (no badge) | yes |
| 20 | "Several answers allowed" | the overline of the card says the type: "Multiple choice" (PB-26). The old sentence is gone | changed |
| 21 | Description | `description` of SQ | yes |
| 22 | Response count | foot of SQ: "1 response" / ":count responses", also while the results are hidden | yes |
| 23 | Results hidden until answered or closed | `results.hidden`; the adapter sends no count, voter or answer while `resultsVisible` is false | yes |
| 24 | Option results | "n · p%" for single and multiple choice (PB-24 A) | changed |
| 25 | Voters | avatars under the option, `img[alt="<name>"]`; each avatar carries its name (`title` and accessible name) in place of one tooltip for the stack | yes |
| 26 | Text answers | `ul[aria-label="Answers"]`, "Your answer", the author when named, "No answers yet.", five then "See :count more" | yes |
| 27 | Reactions | `ReactionChips` in the foot, optimistic, only when the retro has reactions | yes |
| 28 | Comments toggle | button "Comments (n)" with `aria-expanded` | yes |
| 29 | Hidden-results line | "n · Answer to join the discussion" | yes |
| 30 | Comment, reply, edit, delete | `CommentThreadList`, refetch after each write, "Your name is shown with your comment." | yes |
| 31–33 | Refetch, realtime, toast | `survey-api.ts` and `use-retro-board.ts` untouched | yes |
| 34 | Column landmark | `section[aria-label="Surveys"]` with `h2` "Surveys" and the number of surveys | yes |
| 35 | Card landmark | `article[aria-label="<question>"]` (rest props of SQ) | yes |
| 37 | Ten surveys at most | `MaxSurveys` hides the entry | yes |
| 38 | Digits 1 to 5 | handled by SQ inside the card, default prevented; off when the survey is closed or blocked | yes |

### Places left

None (the task names none).

### Differences with the mockup

Captures were not made; the list is read from the code against `SurveyQuestion/preview.html`, `ScreenSurvey/preview.html` and `SessionSettingsPopover/README.md`.

| Difference | Row |
|---|---|
| "Add survey" is a plain button of the settings panel, without the menu "Health check / Quick poll / From a template…" and its note | PB-25, D-22, D-23 |
| The overline of a card is the type alone: no "3 / 5", no "3 max", no "anonymous" badge | PB-26, D-22, D-23 |
| A single-choice result reads "n · p%", as multiple choice, where `SurveyQuestion/preview.html` shows "p%" alone | PB-24 (built as A, the recommendation; the owner's answer is not recorded in `pre-build-deviations.md`) |
| Voters' avatars, reactions, comments, close / reopen / withdraw, the AI draft, "Submit" / "Update answer" on each card, answers as a list | PB-28 |
| The surveys column, the editor dialog, the actions menu and the discussion foot have no mockup: they are composed from the neighbours (column header, `FormDialog`, card menu, card reactions) | no row needed (PB group C heading) |
| The editor dialog is the small `FormDialog` (27.5rem), where the old dialog was 32rem | new row, or none: no mockup |

## Task S2 — Surveys in the completed results

Nothing ran: no Pest, Vitest or browser test, no capture (owner decision). `Plan08dResultsTest.php` under `tests/Browser/Walkthroughs` was not edited (owner decision): `P08d-04c` still reads the bar as `li div.bg-primary`, where the card now gives `[data-slot="survey-result-bar"] > div`.

### Parity (brief 08 §3, row 36)

| # | Action | New control | Done |
|---|---|---|---|
| 36 | Results tab of a completed retro: the surveys, read only | `surveys/survey-result-list.tsx`, mounted by `session-end.tsx` after "Top topics": the card "Surveys" (`section` with its `h2`), one `SurveyQuestion` per survey in `mode="results"`, `closed`, named by its question (`article[aria-label]`), without inputs, Submit, "Withdraw my answer" or the actions menu. The foot is `SurveyDiscussion`: reactions shown without "Add a reaction", comments opened by "Comments (n)", no composer and no "Reply" (`completed` is not a survey phase). "No answers yet." for a text survey without answers. Nothing is rendered when the retro has no survey | yes |

### Places left

None.

### Differences with the mockup

Read from the code against `SurveyQuestion/preview.html` and `ScreenSurvey/preview.html`; no capture.

| Difference | Row |
|---|---|
| The surveys of a completed retro are the cards of the board, read only, in a "Surveys" card of the session end: no results page with the tabs Summary / Free answers / Compare, no CSV, no "Send to whiteboard" | PB-29, D-22 |
| The "Closed" badge shows only on a survey the facilitator closed before the end. Brief 08 row 36 asks for `closed` on every card; it is not forced, since the badge would be a new element on surveys nobody closed and results mode has no control to disable | none: as before the rewrite |
| A viewer who never answered a survey still open at the end sees its option labels without bars or figures, and "No answers yet." for a text survey (the server keeps `resultsVisible` false for them). The foot still reads "Answer to join the discussion", though nobody can answer any more | owner: should the server show the results to everyone once the retro is completed (`PresentSurvey`)? |
| A result reads "n · p%" for single and multiple choice | PB-24 (built as A, the recommendation; the owner's answer is not recorded in `pre-build-deviations.md`) |
