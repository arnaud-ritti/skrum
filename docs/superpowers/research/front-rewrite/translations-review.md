# Translations review — keys added by plans 18e and 18f

Done by an agent on 2026-10-02 (owner decision: one pass per language, no native reviewer). Branch `plan-18g-cleanup`.

Scope: the 733 keys present in `lang/fr.json`, `lang/es.json` and `lang/de.json` that `git show 310a5026:lang/<l>.json` does not have. Only the JSON files changed during plan 18; the PHP files under `lang/<l>/` did not.

Checked for each key: term consistency with the vocabulary the application already had, register, length of labels, `:placeholders`, plural forms.

## Register: informal everywhere (owner decision, 2026-10-02, sixth round)

"Langue : tutoiement partout." Every user-facing text addresses the user informally in every language that has the distinction: French "tu", Spanish "tú", German "du"; English is unchanged. This overrides what the sections below say about the register (French "vous", Spanish mails with "usted") and the wording of the mail mockups.

| | French | Spanish | German |
|---|---|---|---|
| Values changed in `lang/<l>.json` | 485 | 53 | 2 |
| Values changed in `lang/<l>/*.php` | 48 (templates 41, passwords 3, whiteboards 2, auth 1, validation 1) | 6 (passwords 3, actions 1, auth 1, validation 1) | 5 (actions 2, auth 1, passwords 1, validation 1) |

Blade views, PHP code and TSX hold no literal text in these languages: every string goes through the translation files, the static 503 page included.

Plural "vous" kept in French, because the text addresses several people at once:

- the four summaries of the team health check ("L’équipe s’épanouit. Continuez ce qui fonctionne.", "… Gardez cette dynamique.", "… Choisissez-en un à améliorer.", "… Parlez de ce qui aiderait le plus.");
- the three messages posted to a channel (":sharer vous invite à la rétrospective…", "… à la partie de planning poker…", "… à jouer à :game…");
- one retro template column ("… mettez-vous d’accord dessus avant le reste").

Spanish has no such case left: the same texts already used the singular "tú". German keeps "ihr" where it had it.

`tests/Feature/InformalRegisterTest.php` scans the values of the JSON and PHP files of the three languages for formal forms, with an allow-list for the cases above, for the noun "rendez-vous" and for five German sentences that start with a third-person "Sie" or "Ihre".

## Result

| | French | Spanish | German |
|---|---|---|---|
| Keys reviewed | 733 | 733 | 733 |
| Values changed | 48 (10 new keys, 38 older) | 59 (40 new, 19 older) | 189 (119 new, 70 older) |
| Placeholders differing from the key | 0 | 0 | 0 |
| Plural keys without their forms | 0 | 0 | 0 |

"Older" keys are keys from before `310a5026` that held the term or the register being harmonised. Changing only the new half would have left two words for one thing on the same screen.

No test, PHP file or TypeScript file spells any of the changed values.

## What was fixed

### French

- Register: every new key already used "vous" at the time of the review. Superseded: French says "tu" (see above).
- Vocabulary brought to the words of the mockups (`docs/design-system` uses "facilitateur" 185 times against "animateur" once, "deck" 288 times against "jeu de cartes" never, "icebreaker" 135 against "brise-glace" once, "double authentification" against "authentification à deux facteurs" never):
  - "animateur" becomes "facilitateur" (21 values, with the article: "l'animateur" → "le facilitateur", "de l'animateur" → "du facilitateur", "nouvel animateur" → "nouveau facilitateur").
  - "jeu de cartes" becomes "deck" (19 values).
  - "brise-glace" becomes "icebreaker" (5 values).
  - "authentification à deux facteurs" becomes "double authentification" (3 Fortify messages).

### Spanish

- Register: the application says "tú"; the mails say "usted", as the Laravel mail lines the application already had ("Si no ha creado una cuenta…"). 24 new screen strings written with "usted" now say "tú" ("Introduzca el código…" → "Introduce el código…", "Revise su bandeja de entrada" → "Revisa tu bandeja de entrada", the SSO and second-factor messages). One older string too ("Use los interruptores…"). The 19 mail strings stayed with "usted" at the time of the review. Superseded: they say "tú" (see above).
- "mazo" becomes "baraja", the word of the key "Deck" (25 values, 6 of them new).
- "llave de acceso" becomes "clave de acceso" in the three new keys (9 older strings say "clave", 6 say "llave": see the doubtful cases).
- "poker" becomes "póker" where it is a common noun ("partida de póker"); "Planning poker" stays.
- "icebreaker" becomes "rompehielos" in three bench labels.
- Two sentences mixed "vosotros" and "tú" ("Dibujad… elige"): both are "tú" now.

### German

- Register: before plan 18e the file held about 170 strings with "du" (accounts, settings, every mail) and 58 with "Sie" (strings of plans 18a to 18d). Plans 18e and 18f added 78 with "Sie" and 35 with "du", sometimes on the same card. The application's choice is "du": 155 strings were rewritten ("Geben Sie den Code ein" → "Gib den Code ein", "Ihr Konto" → "dein Konto"), mails included, since the older German mails say "du".
- "Maßnahme" (2 older strings, 17 new) becomes "Aktionspunkt", the word of the key "Action items" (48 older strings). "Aktion" becomes "Aktionspunkt" where it means an action item; menus keep "Aktionen".
- "Authenticator-App" becomes "Authentifizierungs-App"; "Session" becomes "Sitzung"; "Health Check" becomes "Gesundheitscheck"; "Workspace" becomes "Arbeitsbereich" in the new keys and in two older ones.
- "Moderator" becomes "Moderation" in four new keys that sat next to "Moderation" on the same screen.

## Doubtful cases for the owner

None of these was changed. Each needs a person who speaks the language, or a decision on a glossary.

### All three languages

| Case | Detail |
|---|---|
| No glossary exists | The harmonisations above follow the majority word or the mockup. A short glossary (facilitator, deck, action item, workspace, board, whiteboard, round, game, passkey, recap) would settle the cases below once. |
| Long buttons | "Create my account and join :workspace" carries a workspace name: "Créer mon compte et rejoindre :workspace", "Crear mi cuenta y unirme a :workspace", "Konto erstellen und :workspace beitreten". Not seen at 390 px. |
| "Remove from team" and "Remove from workspace" | Both read "Retirer" / "Quitar" / "Entfernen" (18e decision). Two different actions with one label. |
| Bench labels | About 120 of the 733 keys are captions of the design-system bench (`/dev/design-system`). They are translated; nobody but a developer reads them. |

### French

| Case | Detail |
|---|---|
| "admin" and "administrateur" | 21 strings say "admin", 39 "administrateur". The mockups use "admin" in short labels. |
| "Sauvegarder" and "Enregistrer" | The key "Save" is "Sauvegarder"; 86 strings use "enregistrer". |
| "tour" and "manche" | Poker rounds are "tours", game rounds are "manches". Probably wanted. |
| "Vous êtes connecté·e en tant que :email" | The only string with a median point. |
| Apostrophes | Straight (') and typographic (’) apostrophes are mixed across the file. |
| "Bon retour parmi nous" | For "Welcome back"; warmer than the rest of the page. |
| "Actions" for "Action items" | 18e decision (PB-12); "Plus d’actions" (the menu "More actions") now sits near "actions" meaning action items. |

### Spanish

| Case | Detail |
|---|---|
| ":inviter le invita a unirse a :workspace" | One key serves the mail (usted) and the invitation card (tú). Settled: "te invita", the mail and the card agree. |
| Mails with "usted" | Settled by the owner: "tú" everywhere; the mail strings and the Laravel lines were changed. |
| "clave de acceso" and "llave de acceso" | 6 older strings still say "llave". |
| "Ajustes" and "Configuración" | The key "Settings" is "Configuración"; 42 strings say "ajustes". |
| "incidencia" and "ticket" | 36 older strings say "incidencia" for an issue of a tracker; the new action-item strings say "ticket". |
| "correo" and "correo electrónico" | Both are used; the new keys prefer the short one. |
| "Qué bueno verte de nuevo" | For "Welcome back"; Latin American in tone. |
| "tablero" and "pizarra" | "tablero" is the retro board, "pizarra" the whiteboard. "Everyone in the workspace can start a board from them" was translated with "pizarra": right only if the sentence is about whiteboard templates (it is today). |

### German

| Case | Detail |
|---|---|
| "du" everywhere | The largest change of this review (189 values). Confirmed by the owner (informal everywhere). Seven more strings found with "Sie" (two in the JSON file, five in the PHP files) now say "du" or use the infinitive. |
| "Deck" and "Kartensatz" | 41 strings say "Deck", 18 "Kartensatz"; the key "Deck" is "Kartensatz". Not harmonised. |
| "Moderator" and "Moderation" | 28 older strings say "Moderator", 19 "Moderation" (the neutral form, and the word of the key "Facilitator"). |
| "Admin" and "Administrator" | 38 and 26 strings. |
| "Icebreaker" and "Eisbrecher" | The key "Icebreaker" is "Eisbrecher"; 11 strings say "Icebreaker". |
| "Workspace" | 17 older strings still say "Workspace" where the others say "Arbeitsbereich". |
| "Tastenkürzel" and "Kürzel" | "Ein-Tasten-Kürzel" for single-key shortcuts. |
| Neutral forms | "Teilnehmende", "verwaltende Person", "Moderation" next to "Spieler", "Administrator", "Inhaber". |
| "Ertrag der investierten Zeit" | For "return on time invested" (ROTI). |
| "Arbeitsbereich erstellen (Formular)" | Bench caption for "Workspace creation"; odd, harmless. |
| Long labels | "Zwei-Faktor-Authentifizierung deaktivieren", "Stattdessen einen magischen Link erhalten", "Benachrichtigungen verwalten": not seen in a button at 390 px (German is not captured). |

## Not done

- No native speaker read any of this.
- English was not reviewed: it is the key.
- Length was judged by reading, not on a screen: only French at 1440 px was captured in plan 18g.
- The keys older than `310a5026` were not reviewed, except where a harmonisation reached them.
