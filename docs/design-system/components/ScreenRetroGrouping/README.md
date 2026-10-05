Board de rétro en phase Regroupement (desktop 1440, EN puis FR) : les cartes sont révélées et chacun les rassemble par glisser-déposer.

**Zones**
- Sidebar repliée (`sidebar(lang, 'sessions', collapsed=True)`), topbar : retour, titre, PhaseStepper 7 phases sur Regroupement (Icebreaker et Écriture cochés), timer, présence, réglages, partage.
- Bandeau d'aide : « Glisse une carte sur une autre… » + compteur `3 groupes · 13 cartes` + connectés.
- Suggestion facilitateur (visible par lui seul) : « 2 doublons probables », Ignorer / **Regrouper automatiquement les doublons** ; les cartes concernées portent une pastille « Doublon probable ».
- 4 colonnes révélées : `CardGroup` dont un titre en édition (anneau `--ring`, ↵ / Esc), un groupe **cible de dépôt** (contour pointillé `--c-t` + emplacement « Relâche pour ajouter au groupe »), carte en cours de drag (`is-dragging`, `--shadow-drag`) tenue par le curseur de Lucas, fantôme à l'emplacement d'origine (`is-ghost`).
- LiveCursor (Lucas, Camille, Yuki), indicateur tréma « Yuki déplace une carte… ».
- Dock bas-centre : `ReactionBar` empilée au-dessus de la `FacilitatorBar` (écart `space-3`) : +2 min, Verrouiller, Annuler le dernier groupe, Vote →.

**Comportement** — déposer une carte sur une carte crée un groupe titré d'après la 1re carte ; sur un groupe, l'ajoute (FLIP 360 ms `--ease-standard`). Un groupe ne mélange pas les colonnes. Le titre est éditable par tous pendant la phase (verrou doux). Clavier : Espace pour saisir une carte, G sur la cible.

**Composants** — Sidebar, PhaseStepper, Timer, PresenceStack, RetroColumn, RetroCard, CardGroup, LiveCursor, ReactionBar, FacilitatorBar.

**Mobile** — une colonne à la fois ; le drag passe par un appui long puis « Ajouter au groupe… » (Drawer listant les groupes de la colonne) ; la suggestion de doublons devient un toast pour le facilitateur.
