# Coverage — retro

Coverage pass of 2026-10-04 on `tests/coverage-retro`. Browser tests run on PostgreSQL (`testing_l63_browser`), feature tests through `bin/test-db pgsql`. New files: `tests/Browser/Walkthroughs/CoverageRetroTest.php` (CVR-01 to CVR-06) and `tests/Feature/Retros/RetroReadRoutesAccessTest.php`.

## Routes

GET routes of the area from `route:list --method=GET`. "Refused" names the test that proves the wrong viewer is turned away.

| Route | Kind | Renders for the right viewer | Refused for the wrong viewer |
|---|---|---|---|
| `retros.show` `/retros/{retro}`, every phase (Icebreaker, Writing, Grouping, Voting, Discussing, Actions, ROTI, Completed) | page | P04-01 to P04-17b, P18e-02-01 (every phase, member and guest), RT21-01 to RT21-16, P08a-02a (Icebreaker), visual P18e-R3-01 (each phase, facilitator and participant, locked), P21-20-01 to 08 | CVR-01 (another team: 403 page; another workspace: 403 page; visitor of a retro closed to guests: login), visual P18e-R2-01 "session ended" (visitor of a guest-enabled retro), P04-10 (guest after a new guest link), P04-11 (deleted retro), R23-11 (observer: read-only); feature `RetroAccessTest` |
| `retros.show`, anonymous retro | page | P04-09, RT21-02, P07-06a, P07-06b, P18e-02-10 (anonymous), visual `retro-board-anonymous`, P21-20-02 | as above |
| `retros.show`, facilitation (timer, pause, cap, finished, topic timer, notes, discussed) | page | RT21-04 to RT21-10, P18e-02-09, P18e-02-11, P18e-02-12, R22S-06, R22S-07, CVR-05 | participant has no FacilitatorBar: RT21-04, RT21-08 |
| `retros.show`, ROTI and reveal | page | P18e-02-03, RT21-12, CVR-02 | vote closed after reveal: RT21-12 |
| `retros.show`, actions phase and bulk export | page | P18e-02-02, RT21-11, RT21-13, CVR-03 | guest has no export: RT21-13 |
| `retros.show`, AI summary | page | P08e-01a to P08e-11b | guest gets no promote button: P08e-08 |
| `retros.show`, completed (results, recap, share) | page | P04-06, P18e-02-04, P18e-02-04b, P18e-02-15 | — |
| `retros.join.show` `/join/{guestToken}` | page | every `joinAsGuest` (P04, RT21, CVR-06), visual P18e-R2-01 (join, all 8 configurations) | visual P18e-R2-01 "invalid guest link"; feature `GuestJoinTest` |
| `retros.snapshot.show` | JSON | used by every board; RT21-10 waits on it | feature `RetroReadRoutesAccessTest` (member, guest, observer 200; other team and other workspace 403; no session 401), `RetroAccessTest` |
| `retros.gifs.index` | JSON | P07-05a; feature `GifsTest` | feature `RetroReadRoutesAccessTest`, `GifsTest` (phase, lock, turned off) |
| `retros.surveys.show` (attached survey) | JSON | P08c-01 to P08c-03, visual P18e-08-04; feature `SurveysTest` | feature `RetroReadRoutesAccessTest` |
| `retros.action-items.comments.index` | JSON | P09a-02, P09a-04; feature `ActionItemCommentsTest` | feature `RetroReadRoutesAccessTest`, `ActionItemCommentsTest` (item of another retro 404) |
| `retros.action-items.exports.preview` | JSON | P18e-02-14, RT21-13, CVR-03; feature `ExportResolutionTest` | feature `ExportResolutionTest` (other user 403, guest 403) |
| `gifs.show` `/gifs/{gif}/{size}` | asset | P07-05a; feature `GifsTest` (cache, unknown id 404, bad size 404) | public by design (no viewer); `GifsTest` refuses ids and sizes outside the pattern |

Phone 390x844, dark and English on the board: P04-15a, P04-16a, P04-17a/b, P18e-02-06, RT21-14, RT21-15, RT21-16, visual P18e-R13-01 (phone drawers) and the 8 configurations of every `captureVisuals` capture.

## Acceptance criteria — plan 21 (§13)

| # | Criterion | Test |
|---|---|---|
| 1 | Writer's name under the column and ringed avatar, gone after publish | RT21-01 |
| 2 | Anonymous count only, payload and guards | RT21-02; feature `WritingCountTest`, `FacilitationAccessTest` (guards, 403/423/429) |
| 3 | "Name is moving a card…" in Grouping | RT21-03 (keyboard) |
| 4 | Activity from offline / self / wrong kind ignored | Vitest `lib/retro/activity` (not browser-visible) |
| 5 | Pause, +2 min on pause, resume | RT21-04; 422/403 guards in feature tests |
| 6 | Timer never both ended and paused | unit/feature (model invariant, not browser-visible) |
| 7 | Cap per card, settings until Grouping | RT21-05, CVR-05; race in `tests/Concurrency` |
| 8 | "I have finished voting", taken back by a vote | RT21-06 |
| 9 | "x/y have finished" counts guests and facilitator | RT21-06, RT21-14 |
| 10 | Topic timer restarts on next topic, marks topic left discussed | RT21-07 |
| 11 | "Now · mm:ss left", "Discussed · n actions", "~ n min left" | RT21-07, RT21-08, RT21-11 |
| 12 | Mark / unmark discussed, live | RT21-08 (403/422 in feature tests) |
| 13 | Notes saved with version, shown everywhere | RT21-09 (409/423/403 in feature tests) |
| 14 | "Name is taking notes…" read-only, "Your text was not saved" | RT21-09, RT21-10 |
| 15 | Recap mail notes, AI input | feature (mail and summary input; not a browser screen) |
| 16 | Action linked to the topic, topic shown in Actions | RT21-11 |
| 17 | "Topic actions" and "Other action items (n)" | RT21-11 |
| 18 | Reveal shows mean to all and closes the vote; leaving and returning hides it | RT21-12, CVR-02 |
| 19 | Nudge only the ones who have not voted | RT21-12 (429/403 in feature tests) |
| 20 | Bulk export one by one, failure listed and retried, "Already exported", no guest button | RT21-13, CVR-03 |
| 21 | "Max per card" with "No limit" by default; read-only for a participant | CVR-04, CVR-05 |
| 22 | Retro without the new settings behaves as before | CVR-06 |
| 23 | Strings in four languages, informal | `TranslationKeysTest`, `InformalRegisterTest`, RT21-16 |
| 24 | Six phases captured in light, 1440, French | visual P21-20-01 to 08 |
| 25 | Suites on PostgreSQL | run per plan |

## Mockups

Mockups rendered from `docs/design-system/components/<Name>/preview.html` at 1440 with `app.css`, `_preview-bundle.css` and lucide icons (no `bundle.js` exists); app captured from the visual tests (light, 1440 and 390, French). Only ShareDialog has a dark section in its preview. Captures stayed in a temp folder.

| Mockup | Status | Notes |
|---|---|---|
| ScreenRetroWriting | open | Topbar uses the compact stepper ("Phase 1/6 · Écriture"); with a running timer the phase name is cut to "É…" at 1440 and "Écrit…" at 390. FacilitatorBar has no "Révéler les cartes" (D-10 backlog) nor "Anonymat : activé"; "+2 min" sits in the topbar. Add-column form shown open at the right edge. |
| ScreenRetroGrouping | open | No duplicates suggestion nor "Annuler le dernier groupe" (backlog); lock icons on column headers. |
| ScreenRetroVote | open | Vote button is a thumbs-up count, not "+ Voter"; the "n votes sur m exprimés" progress (parity row 57) is not in the mockup and is set in the mono font of `Progress`. |
| ScreenRetroDiscussion | open | No "Arnaud a mis ce sujet en focus — 8/8" banner; action form uses a native date input (shows mm/dd/yyyy) instead of the date button; expanded action items (sub-task, comments) are taller than the mockup; FacilitatorBar overlaps the right column's bottom edge. |
| ScreenRetroActions | open | Native date input instead of the date button; action items expanded with sub-task and comment rows. |
| ScreenRetroROTI | fixed / open | Fixed: "Réfléchit" without the ellipsis. Open: session end has no "Exporter" menu (PDF / CSV / Markdown / Jira) and the compact actions list differs; the ROTI trend shows only with history. |
| MobileRetro | open | Voting uses the desktop thumbs-up instead of the large ± stepper per card; "J'ai terminé de voter" is not a sticky footer; phase name cut ("Écrit…") in the compact stepper. |
| FacilitatorBar | open | Bench has no "Facilitateur" label or ring timer inside the bar (the board places them); compact bar wraps "Regroupement" to a second row where the mockup keeps one row. |
| PhaseStepper | open | No state with every phase labelled; compact facilitator uses arrow icons instead of "Phase suivante →". |
| RetroCard | open | Composer counter reads "/1000"; mockup limits a card to 280 characters (product rule, not changed). |
| RetroColumn | matches | Lock icon in header (see Grouping). |
| VoteDots | matches | Mockup's "Budget épuisé" label is preview-only; the board shows the author there. |
| ROTIWidget | fixed | French question mark now on a no-break space (was orphaned on its own line in narrow cards). |
| Timer | fixed / open | Fixed: ring arc in the primary colour on a faint track. Open: minutes not zero-padded ("4:32" vs "04:32"); `formatSeconds` is shared with poker and games. |
| ReactionBar | open | Structure matches; in the bench "Rafale de 200" the aggregated chips overlap one another (not checked whether only mid-animation). |
| GifPicker | matches | |
| PresenceStack | fixed | Guest count is a muted pill with the mask icon. |
| LiveCursor | fixed / open | Fixed: "Afficher les curseurs". Open: bench settings have no help lines nor the "n curseurs masqués" chip. |
| ConnectionState | fixed | ":name édite la carte". Overlay reads "Reconnexion… (1/5)" instead of "Reconnexion à la session…" (kept: more informative). |
| SessionSettingsPopover | fixed / open | Fixed: "Verrouiller le board" / "Lock board" for the lock switch. App has more rows than the mockup (title, Icebreaker, GIFs, AI, presentation). |
| ShareDialog | open | Wording: "Rôle par défaut" vs "Rejoindre en tant que", "Autoriser les invités" vs "Invités anonymes autorisés", "Copier le lien" vs "Copier", "Créer un nouveau lien" vs "Régénérer le lien"; app adds "Publier un lien". Shared with other session types, left for the owner. |
