Salle d'icebreaker : le facilitateur choisit un mini-jeu d'échauffement, l'équipe joue en temps réel avant la rétro.

**But** — Détendre et faire parler tout le monde dans les 5-10 premières minutes, invités anonymes compris, puis enchaîner sur la rétro (« Passer à la rétro »).

**Zones**
- **Topbar** : fil d'Ariane de la session, badge durée, `sk-timer` global de l'icebreaker, `sk-stack` des joueurs, sortie vers la rétro.
- **Colonne gauche (340 px)** — Choix du jeu : grille 2 colonnes d'`IcebreakerGameCard` (`sk-game sk-c-*`, art compact 64 px), le jeu actif est cerclé `--primary` avec badge « En cours ». Carte de réglages (thème des mots, temps par tour, invités).
- **Scène (centre, `--skrum-canvas`)** — Pendu : manche, `sk-timer--lg` du tour, potence SVG (parties perdues en `--skrum-destructive-text`, restantes en pointillés `--border`), compteur d'erreurs, mot à trous (`sk-letter`), bandeau « À toi de jouer », clavier AZERTY (`sk-key` `is-hit` / `is-miss` / survol), proposition du mot entier.
- **Colonne droite (320 px)** — Scores classés (tour en cours surligné), tour de parole (avatars passés estompés, courant cerclé), fil des derniers coups, réactions emoji.

**Composants** : IcebreakerGameCard, Timer, PresenceStack, Avatar, Badge, Select, Switch, Button, réactions (`sk-react`).

**Mobile** — Choix du jeu dans une Sheet (facilitateur seulement). Scène plein écran : mot en `sk-letter` 32 px (retour à la ligne si > 9 lettres), clavier pleine largeur à touches 44 px, scores repliés en `sk-stack` + Drawer. Hors de son tour, le clavier est désactivé (`is-disabled`) avec « Tour d'Inès ».

**Classes locales** (candidates à `bundle.css`) : `.ib-player` / `.is-turn` (ligne de classement), `.ib-order` (tour de parole), `.ib-turn` (bandeau de tour), variantes `sk-letter` 44×56 et `sk-key` 46×48, `.sk-game-art` compact 64 px.

## Réactions

Les réactions passent par la **ReactionBar** (voir ce composant), ancrée en bas au centre de la zone de jeu (`.sk-rbar-dock`), avec les réactions reçues qui s’envolent au-dessus. Pas de pastilles de réactions dans la colonne des scores.
