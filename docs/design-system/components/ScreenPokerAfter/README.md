Salle de planning poker après révélation (desktop 1440×900) : lire le résultat, trancher, passer à la story suivante.

**Zones**
- Topbar : badge « Tour 1 · révélé ».
- Story (identique à l'écran « avant »).
- Table : toutes les cartes retournées ; les votes extrêmes (3 et 13) cerclés `--skrum-warning-text` + mention « écart » ; au centre, médiane et nombre de votes.
- Barre de résultat : Moyenne 6,5, Médiane 5, badge Dispersion 3 → 13 + consensus 50 %, distribution (sk-dist, barre dominante en `--chart-1`), choix de l'estimation finale (PokerCard sm, 5 sélectionnée), « Valider 5 pts · Story suivante », Revoter, ouvrir la discussion avec les votes extrêmes.
- ReactionBar (classes `sk-rbar*` du bundle) : même place que sur l'écran « avant », centrée au-dessus du panneau de résultat, écart `--space-3`, dans le flux (`.scr-dock`), sans chevauchement.
- File des stories : story en cours « À valider ».

**Règles** — consensus = part des votes sur la valeur modale ; au-delà de 2 crans d'écart sur l'échelle, afficher la dispersion en warning et proposer la discussion avant de revoter. L'estimation validée est écrite dans Jira si la story est liée.

**Mobile** — résultats en Card empilée (stats, distribution, choix), bouton principal collé en bas.
