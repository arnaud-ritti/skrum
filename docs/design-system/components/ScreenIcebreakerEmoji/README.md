Salle d'icebreaker « Devine l'emoji » : décoder une suite d'emojis (film, expression d'équipe…) avant la fin du chrono, avec des indices progressifs.

**But** — Échauffement rapide et inclusif (pas besoin de dessiner ni de parler), 8 énigmes de 60 s ; EN puis FR.

**Zones** (sidebar repliée `active='games'`, grille 300 px · scène · 340 px)
- **Colonne gauche — Manches** : énigmes résolues (emojis + réponse + `5/6` trouvés), énigme en cours surlignée, énigmes à venir **masquées** (cases pointillées, aucune fuite d'emoji). Carte de réglages : catégories, chrono, indices auto.
- **Scène** : manche, catégorie, `sk-timer--lg`. Carte d'énigme (`sk-c-sky`) avec emojis 72 px dans des tuiles `--card`, méta (catégorie, nombre de mots, barème). **Indices progressifs** : 1 révélé d'emblée, 2 révélé à 0:30, 3 verrouillé (bordure pointillée, « dans 0:08 », coûte −20 pts si demandé avant). Retour sur la dernière tentative (`sk-alert--warning` « Presque ! 2 mots sur 3 sont justes »), champ de réponse + Répondre + « Indice maintenant (−20) ». Pastilles « Trouvé » (avatar · temps · points) et « Tes tentatives » (ratée barrée, « presque » en warning).
- **Colonne droite** : **classement de la manche** (trouvé = coche + points, sinon « cherche… », toi surligné), puis total après 3 manches en barres `sk-progress`.
- **ReactionBar** dockée bas-centre de la scène.

**Composants** : Sidebar, Timer, Avatar, Badge, Alert, Input, Button, Progress, Select, Switch, ReactionBar.

**Accessibilité** — La suite d'emojis porte un `aria-label` descriptif (« glaçon, marteau ») ; les indices révélés sont annoncés (`aria-live="polite"`) ; la bonne réponse n'est jamais envoyée au client avant la fin de la manche.

**Mobile** — Énigme + champ en plein écran, indices en accordéon, classement en Drawer ; liste des manches repliée en « 4 / 8 ».

**Classes locales** : `.em-round` (ligne de manche done/cur/next), `.em-puzzle`, `.em-big`, `.em-hint` (`.is-locked`), `.em-chip`, `.em-try`, `.em-bar` — plus la grille `.g-*` partagée.
