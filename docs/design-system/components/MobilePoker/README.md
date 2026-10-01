Maquettes mobiles 390×844 du planning poker : avant révélation, choix de carte en Drawer, résultat.

**Zones**
- *Avant révélation* : story (`sk-ticket` ATLAS-1287), rangée de participants défilante (carte dos `is-hidden` si voté, emplacement pointillé + `sk-trema` sinon, avatar en pastille), infos de story, deck en bas défilant horizontalement (cartes 60×86, carte choisie relevée).
- *Drawer* : grille 4×3 du deck complet (72×100), cartes spéciales ? et ☕ en `is-special`, validation `sk-btn--lg`.
- *Après révélation* : cartes révélées (extrêmes en `--skrum-destructive-text`), moyenne / médiane / écart, distribution `sk-dist`, alerte d'écart, choix de l'estimation retenue, validation + story suivante (vue facilitateur).

**Choix mobiles**
- La table ovale desktop (`sk-ptable`) devient une rangée horizontale : lisible à une main, extensible à 12 personnes.
- Deck ancré en bas (zone du pouce) ; « Tout le deck » ouvre un Drawer plutôt qu'un Popover.
- Toutes les cibles ≥ 44 px (cartes, boutons, estimation retenue 52 px).

**Composants** : PokerCard, PokerTable (→ rangée), Drawer, Alert, Badge, Avatar, Button.
