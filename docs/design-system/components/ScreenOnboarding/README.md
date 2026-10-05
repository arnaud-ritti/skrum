Premier lancement et acceptation d'invitation (desktop 1440, EN puis FR) : créer l'espace, la première équipe, inviter, choisir un premier rituel ; puis rejoindre une équipe depuis une invitation.

**But** — amener une personne seule à une équipe prête à faire sa première rétro en moins de 2 minutes, et faire rejoindre un invité sans friction (SSO d'abord).

**Zones · onboarding** (pas de sidebar : elle n'apparaît qu'une fois l'équipe créée)
- En-tête : logo, **stepper** au centre (réutilise `PhaseStepper` : `sk-phases`, étapes faites en `is-done`, courante en `is-current`, `aria-current="step"`), avatar + « Se déconnecter ». Barre de progression fine (`sk-progress`, 0.1875rem) collée sous l'en-tête.
- Étape 2 (montrée en plein) : sur-titre « Étape 2 sur 4 », titre display-lg, nom de l'équipe (focus), **couleur** parmi les 8 couleurs de colonnes (radiogroup, coche, nom de la couleur sous la grille), lien d'équipe (slug éditable, `font-mono`), description facultative ; actions « Retour » / « Passer pour l'instant » / « Continuer » (lg). À droite, panneau `sk-dotgrid` d'aperçu live : sélecteur d'équipe, carte d'équipe vide (squelettes statiques), « Ensuite ».
- Autres étapes (cartes réduites) : **1 · Espace de travail** (nom, logo facultatif, langue par défaut) ; **3 · Invitations** (champ e-mails en puces avec puce invalide + `sk-error-msg`, rôle, lien d'invitation copiable avec expiration, « Passer » / « Envoyer 3 invitations ») ; **4 · Premier rituel** (4 cartes radio Rétro / Poker / Whiteboard / Icebreaker sur fond de couleur de colonne, date facultative, « Créer la rétro » ou « Aller au tableau de bord »).

**Zones · accepter l'invitation**
- Carte centrale (`w-120`) : avatar de l'invitant + pastille d'équipe, phrase « Camille Roux t'invite à rejoindre l'équipe Atlas de l'espace Nordlys », membres + rôle attribué, message de l'invitant ; « Continuer avec SSO (OIDC) » en premier, Google / GitHub, e-mail verrouillé (celui de l'invitation), mot de passe à créer, « Créer mon compte et rejoindre Atlas », lien « Se connecter » ; « Refuser l'invitation » (ghost, icône + texte destructif) avec conséquence.
- Variantes : déjà connecté·e (« Rejoindre Atlas en tant que Nadia Benali ? » + « Refuser » + changer de compte), lien expiré (demander une nouvelle invitation), refusée (confirmation).

**Composants** — PhaseStepper, Progress, Input, Field, Select, Radio, Button, Card, Avatar/PresenceStack, Skeleton, Alert d'erreur de champ.

**Classes locales à promouvoir** — `.ob-sw` (sélecteur de couleur d'équipe, réutilisable dans Paramètres d'équipe), `.ob-chips` / `.ob-chip` (saisie multi-e-mails), `.ob-rit` (carte radio à icône colorée), `.ob-mark` (pastille d'équipe colorée par `--c`).

**Comportement** — chaque étape est sauvegardée à « Continuer » (reprise possible) ; « Passer » sur 3 et 4 seulement. En self-host avec SSO forcé, l'étape 1 est remplie par l'admin et sautée. Une invitation acceptée connecte et ouvre le tableau de bord de l'équipe ; si une session est en cours, une bannière propose de la rejoindre.

**Tailwind** — split `grid grid-cols-2`, formulaire `px-24 py-12 gap-5 max-w-180`, aperçu `border-l bg-dotgrid p-12` ; pastille couleur `size-9 rounded-md border bg-(--col) border-(--col-border)` (contexte `.col-*`) ; carte d'invitation `w-120 p-8 shadow-raised`.

**Mobile** — stepper compact (`is-compact` : numéros seuls sauf l'étape courante), formulaire pleine largeur `p-4`, aperçu masqué, actions collées en bas (`sticky bottom-0`) ; invitation en pleine largeur, variantes identiques.
