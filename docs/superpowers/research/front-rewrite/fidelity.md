# Fidelity pass — every page against its mockup

Plan 18g Task 8, reduced by the owner to **one configuration: light theme, 1440 px, French**. Done on 2026-10-02 by an agent, on branch `plan-18g-cleanup`.

## How it was done

- The visual tests of `tests/Browser/Visual` (14 files, 251 tests) ran with `VISUAL_ONLY=light-1440-fr`, a filter added to `CapturesVisuals` for this pass. They pass. 247 captures were written: 160 of pages and states, 87 of bench sections.
- Each mockup (`docs/design-system/components/<Screen>/preview.html`) was drawn at 1440 px with its stylesheet and compared with the capture by eye, with the README of the screen where a doubt remained.
- A difference is tied to a row that already exists (D-nn: table of the 18e plan; V-nn: table of the 18f plan), fixed, or given a new row in `deviations.md`.

## What this pass is not

- **Dark theme, 390 px and English were not captured and not compared.** The captures of those seven configurations in `tests/visual/__screenshots__` are older than the last screens and are stale.
- 108 of the 160 page captures were opened. The 52 others are further states of pages that were opened (list at the end). The 87 bench captures were not compared: they show components, not pages.
- Most captures were opened before the fixes below; after the fixes every capture was taken again, and only the poker header and the branding tabs were looked at a second time.
- No person compared anything. An agent reading two pictures misses small spacing and colour differences.
- Whether a D or V row describes its page correctly was checked only where the difference was visible in the capture.

## Counts

| | |
|---|---|
| Rows (a page, or a page and its states) | 45 |
| Faithful: every difference seen is already a recorded row | 8 |
| With differences, all tied to a row | 32 |
| No mockup to compare with | 3 |
| Not opened | 2 |
| Differences fixed in this pass | 9 (7 commits) |
| New deviation rows, to approve by the owner | 4 (D-128 to D-131) |
| Plain breakage found | 6, all fixed: "Ouverte" on a link, "1 colonnes", image tabs cut, breadcrumb cut, poker badges cut, a colon alone at the start of a line |

## Fixed in this pass

| Commit | What |
|---|---|
| `489f83e9` | Workspace page: the link of a team tile read "Ouverte" (the status key "Open"); it reads "Ouvrir l'équipe" |
| `0f8f2d09` | Template picker and session form: "1 colonnes" |
| `52945310` | French: non-breaking space before `: ; ? !` and inside « », 469 values (mails left as their mockup) |
| `cabda665` | Branding: the four image tabs on two rows; the unsaved line only when something is unsaved; "Sauvegarder" → "Enregistrer" |
| `5faee0d6` | "Résumé" → "Synthèse" (team page), "Depuis le début" → "Depuis toujours" (leaderboard) |
| `ac1ad504`, `da09dabe` | Poker room: a header narrower than 110rem shows the round alone |

## Page by page

| Page | Captures | Mockup | Verdict | Differences and where they are recorded |
|---|---|---|---|---|
| Team page | `team-page`, `team` (bench states) | ScreenTeam | differences | One "Nouvelle session" button, no four tiles: D-09. No next retro, no "Tout afficher", no counts or avatars on a retro card, no whiteboard thumbnails, no role badge, no "Inviter": D-18. "Animé par", "Reprendre": D-73. "Ouvrir la partie", ended games: D-74. Mood card in the main column, team settings card, "Retirer" / "Ajouter un membre": D-75, D-77. "notés de 1 à 10": D-76. Header button "Jeux": D-128. Sidebar: D-129. **Fixed**: "Résumé" → "Synthèse" (`5faee0d6`). |
| Workspace page | `workspace-page`, `workspace-page-leave`, `workspace` | ScreenWorkspace a, b | faithful | No team description: D-24. Activity lines: D-91. Leave consequences: D-92. **Fixed**: the tile link read "Ouverte" (`489f83e9`). |
| Workspace members | `workspace-members`, `workspace-members-invite` | none (Members card of ScreenSettings a) | differences | D-93. |
| Workspace templates | `workspace-templates`, `-retro`, `-editor` | ScreenWorkspace c, d; TemplateEditor | faithful | Empty state, "Créer un deck", usage line: D-94, D-24. **Fixed**: "1 colonnes" (`0f8f2d09`); a sentence broke before its colon (`52945310`). |
| Workspace creation | `workspace-create` | ScreenOnboarding (one step) | differences | The four-step onboarding: D-33. |
| Login | `access-login-page`, `login-with-magic-link` | ScreenAuth | faithful | Passkey button: D-53. "Rester connecté", no footer links: D-28. Language select in the frame: existing feature. |
| Login, link sent | `login-magic-link-sent` | ScreenAuth, link sent | differences | V12, V13. |
| Login under required SSO | `login-sso-required`, `-administrator` | ScreenAuth, SSO | differences | V24. |
| Register | `access-register-page` | ScreenAuth, register | differences | D-52, D-28. |
| Invitation | `access-invitation-page`, `-accept-`, `-expired-`, `-invalid-`, `-wrong-account-` | ScreenAuth, invitation | differences | D-54, D-30, V32. |
| Two-factor challenge | `access-two-factor-page`, `-recovery-`, `two-factor-email-code` | ScreenAuth, 2FA | faithful | Seen: with the e-mail code, two near-identical sentences above the field, and a countdown beside a disabled "Renvoyer le code". Not changed. |
| Password pages | `access-confirm-password-page`, `-forgot-`, `-reset-`, `access-verify-email-page` | ScreenAuth (no frame of their own) | faithful | D-53. |
| Magic link, unsubscribe | `magic-link-invalid`, `recap-unsubscribe-page` | none | no mockup | Composed on the auth frame (18f). |
| Error pages | `access-error-403-page`, `-404-`, `-404-guest-`, `-419-`, `-429-`, `-500-`, `-503-` | ScreenErrors | faithful | D-31, D-55. Seen: the 500 page has no footer line, the others have one. |
| Settings, profile | `settings-profile-page`, `-unverified`, `-delete-dialog` | ScreenUserSettings | differences | One page per section, not one long page: D-130. No presence colour, no photo: D-25. Footer sentence: D-78. |
| Settings, appearance | `settings-appearance-page` | ScreenUserSettings | differences | D-25, V22. |
| Settings, notifications | `settings-notifications-page`, `-reminders-off` | ScreenUserSettings | differences | Two events of six: D-25. D-84. |
| Settings, API tokens | `settings-api-tokens-page`, `-empty`, `-error`, `-new-token` | ScreenUserSettings | differences | D-82, D-83. |
| Settings, security | `settings-security-page` and its six states | ScreenSecurity | faithful | D-26, D-79, D-80, D-81, D-95, V23. Seen: with the e-mail code on, the card says "Activée" while the app row offers "Activer la 2FA". |
| Team settings, integrations | `team-integrations-page` and its ten states | ScreenSettings a | differences | D-27, D-85 to D-89. Seen: a stored connection error is shown in English on a French page. |
| Admin, branding | `admin-branding-page`, `-exact-radius-staged` | ScreenSettings b | differences | D-35, D-90. **Fixed**: the four image tabs were cut; "Sauvegarder" → "Enregistrer" (`cabda665`). |
| Admin, admins and sign-in | `admin-admins-page`, `admin-sign-in-*` | none | no mockup | D-35. **Fixed**: the breadcrumb was cut by the unsaved line (`cabda665`). Seen: the entry "Authentificatio…" is cut by its badge in the sub-navigation. |
| Retro, writing | `retro-board-facilitator`, `-participant`, `-anonymous` | ScreenRetroWriting | differences | D-10, D-97 to D-101, D-108. |
| Retro, grouping | `retro-board-grouping`, `-locked` | ScreenRetroGrouping | differences | D-10, D-103, D-104. |
| Retro, voting | `retro-board-voting` | ScreenRetroVote | differences | D-11, D-105. |
| Retro, discussing | `retro-board-discussing`, `-locked` | ScreenRetroDiscussion | differences | D-12, D-106. |
| Retro, actions | `retro-board-actions`, `-locked` | ScreenRetroActions | differences | D-04, D-13, D-107. Seen: the reaction bar and the facilitator bar float over the last action card; the date field shows the browser's "mm/dd/yyyy". |
| Retro, ROTI and end | `retro-board-roti`, `-roti-participant`, `-completed` | ScreenRetroROTI | differences | D-14, D-15, D-109 to D-112. |
| Retro, health check | `retro-board-health`, `-locked` | none (HealthCheck component) | differences | D-03, D-102. |
| Retro, icebreaker | `retro-board-icebreaker`, `-round` | ScreenIcebreaker | differences | D-20, D-124, D-125. |
| Guest join | `retro-join`, `poker-join`, `games-join-page`, `whiteboard-join` and their invalid states, `retro-session-ended` | GuestJoin | differences | D-32, D-51, D-115, D-126, D-127. |
| Poker room | `poker-room-voting`, `-revealed`, `-settings`, `-import`, `-source`, `-share` | ScreenPokerBefore, ScreenPokerAfter, ScreenPokerQueue | differences | D-02, D-16, D-64 to D-71. **Fixed**: the round and option badges were cut in the header (`da09dabe`). |
| Estimation history | `poker-estimates`, `-empty`, `-rounds` | none | no mockup | D-17, D-72. |
| Saved decks | `saved-decks-page`, `-editor` | DeckPicker | differences | D-45, D-46. |
| Games page | `games-index-page`, `-empty-` | GamesLeaderboard | faithful | D-20, D-56. "Salons": D-131. **Fixed**: "Depuis le début" → "Depuis toujours" (`5faee0d6`). |
| Game rooms | `games-room-*` (11 captures) | ScreenIcebreaker, -Draw, -Emoji, -Gif | differences | D-20, D-57 to D-62. |
| Whiteboard | `whiteboard-board` and its nine states | ScreenWhiteboard | differences | D-21, D-47 to D-50, D-63. Seen: the team name of these captures is random, so they change at every run. |
| Action items | `actions-page`, `actions-index`, `-delete`, `-deleted` | ScreenActions | differences | D-19, D-116 to D-120. |
| New session | `session-create`, `-poker`, `-whiteboard`, `-icebreaker` | ScreenSessionCreate | differences | D-06 to D-09, D-40 to D-44. The captures show one type tile: the bench gives the dialog one form. The dialog with its four types was not captured. |
| Session shell | `session-shell` | none | not opened | Bench of the shell. |
| Bell | `bell-three-kinds`, `bell-empty` | NotificationsPanel | differences | V14 to V17. |
| Command palette | `command-palette-*` | Command | differences | V18, V19. Seen: `command-palette-results` is taken while "Recherche…" still spins: the content results are not in the picture. |
| Keyboard shortcuts | `keyboard-shortcuts-dialog*` | KeyboardShortcuts | differences | V20, V21, V27 to V31. |
| Mails | `mail-*` (10 captures) | Emails | differences | V1 to V11, V25, V26. Seen: the recap preview is drawn with empty data ("Participants (0) :"). |
| About | `about-page` | none | not opened | Page of plan 18d. |

## Seen and left as it is

These are not differences with a mockup. They are listed for the owner.

- Two-factor challenge by e-mail: two sentences say the same thing; a countdown sits beside a disabled button.
- Security: "Activée" on the card while the app row offers "Activer la 2FA" (the e-mail code is on, the app is not).
- Team integrations: the error a connection stored is shown as the server wrote it, in English.
- Admin sub-navigation: "Authentification SSO" is cut by its badge.
- Retro, Actions: the two floating bars cover the last card until the page is scrolled.
- Workspace members: "Renvoyer" and "Révoquer" stack on two lines in an invitation row.
- The 500 page has no footer line.
- The date field of the quick add shows the browser's own format.

## Captures not opened

`about-page`, `access-error-404-guest-page`, `access-error-419-page`, `access-invitation-invalid-page`, `access-two-factor-recovery-page`, `actions-index`, `actions-index-deleted`, `admin-branding-exact-radius-staged`, `admin-sign-in-blocked`, `admin-sign-in-not-in-force`, `admin-sign-in-off`, `bell-empty`, `command-palette-empty`, `command-palette-no-result`, `games-index-empty-page`, `games-join-invalid-page`, `games-join-page`, `games-room-decoded-guesser`, `games-room-draw-guesses`, `games-room-gif-voting`, `keyboard-shortcuts-dialog-filtered`, `keyboard-shortcuts-dialog-no-result`, `mail-action-reminder-white-label`, `mail-invitation-white-label`, `mail-magic-link`, `mail-magic-link-white-label`, `mail-retro-recap-white-label`, `mail-two-factor-code`, `mail-two-factor-code-white-label`, `poker-estimates-empty`, `poker-join`, `poker-join-invalid`, `poker-room-source`, `retro-board-discussing-locked`, `retro-board-grouping-locked`, `retro-board-health-locked`, `retro-join-invalid`, `session-create-icebreaker`, `session-create-whiteboard`, `session-shell`, `team-integrations-jira-data-center`, `team-integrations-setup-required`, `team-integrations-telegram-code`, `team-integrations-url-dialog`, `team-integrations-webhook-secret`, `whiteboard-board-colors`, `whiteboard-board-cursor`, `whiteboard-board-delete`, `whiteboard-board-export`, `whiteboard-board-hand-over`, `whiteboard-join`, `whiteboard-join-invalid`
