Salle de planning poker fidèle à l'app (desktop 1440), mode observateur et historique des tours, plus les pages Estimation history et Saved decks. 4 frames : salle EN, salle FR, pages EN, pages FR.

**Un seul modèle de salle : la table.** Toutes les salles de poker (ScreenPokerBefore, ScreenPokerAfter, ScreenPokerQueue) reprennent la même disposition : story en haut, participants assis autour d'une table ovale (`sk-ptable` + `sk-seat`), file des stories à droite, deck en bas, ReactionBar au-dessus du deck. L'ancien modèle (tâches à gauche, cartes alignées en rangée) est abandonné et ne doit plus être utilisé.

**Salle (frames a, b)**
- Topbar : retour, « Atlas · Planning poker » + nom de partie, badge deck **Fibonacci**, toggle **Watch only** activé (pill `skrum-primary-soft` + switch), **Hide tasks** (`panel-right-close`, `aria-controls` vers la file de droite, qu'il masque), présence, réglages, avatar.
- Bandeau observateur (`skrum-info-soft`, `role="status"`) : le facilitateur anime sans voter ; lien « Join the vote ».
- Story (Card, en haut) : ticket, type, position dans la partie, éditer / supprimer, titre, description ; à droite, **Rounds (2)** déplié (`aria-expanded="true"`) : tour 2 courant (`skrum-primary-soft`) et tour 1 « re-voted », votes en puces mono.
- Table : 7 sièges, cartes révélées (`sk-pcard--sm`, `?` en `is-special`) ; au centre, « Cards revealed · Round 2 », moyenne, valeur la plus votée, distribution `sk-dist` (`?` en gris). Le facilitateur observateur n'a **pas de siège** : il est affiché à part, en haut à gauche, dans un encart pointillé « Observer » (avatar, couronne `--skrum-warning-text`, « Watching »).
- Dock bas (`.pk-dock`, colonne flex, `margin-top: auto`) : **ReactionBar** du bundle (`sk-rbar`, `sk-rbar-e` > `<span>` emoji, `sk-rbar-sep`, `sk-rbar-add` + `smile-plus`) centrée au-dessus du panneau du deck, écart `--space-3`, dans le flux, jamais en chevauchement. Panneau du deck (même grammaire que `.scr-deckbar` de ScreenPokerBefore) : en-tête « Deck disabled while you watch only » + actions facilitateur Re-vote / Estimate (select) / Save estimate / Next task ; deck 0 1 2 3 5 8 13 21 34 55 89 ? ☕ en `sk-pcard.is-disabled`, `aria-disabled="true"`. La ReactionBar reste active pour l'observateur.
- File des stories (droite, 20rem) : « Tasks (6) », points estimés, items avec poignée `grip-vertical`, ticket, titre, badge **Votes: n** (tâche active en `sk-badge--soft` + « Round 2 », tâches estimées avec points), indicateur de dépôt (`pk-drop`), « Add a task… » + Add, réglages facilitateur (deck, révélation auto, observateurs).

**Pages (frames c, d)** : deux panneaux côte à côte, chacun avec une barre « Back to the team ».
- Estimation history : recherche, filtres deck / partie / période, case « Re-voted only », table tâche (titre + ticket), estimation (pastille display), deck, date, votants (pile + n), rounds (badge warning si > 1), pagination, Export CSV.
- Saved decks : cartes de deck (nom, nb de valeurs, usage, aperçu des valeurs), Default, decks intégrés verrouillés (Duplicate seulement), decks perso (Edit / Duplicate), tuile « Create a custom deck ».

**Composants** : sk-topbar, Badge, Switch, Button, ReactionBar (`sk-rbar*`), PokerTable (`sk-ptable`, `sk-seat`), PokerCard (`sk-pcard`), `sk-deck`, `sk-dist`, `sk-stat`, `sk-ticket`, Card, Table, Select, Checkbox, sk-stack.

**Mobile** : table remplacée par une grille d'avatars + carte, observateur en chip au-dessus, file des stories en Drawer (Hide/Show tasks), Rounds repliés par défaut, deck en défilement horizontal, ReactionBar repliée en bouton smile-plus au-dessus du deck. Pages : table → liste de cartes, decks en 1 colonne.

**Classes locales** : `pk-watch`, `pk-banner`, `pk-observer`, `pk-dock`, `pk-deckbar`/`pk-deckhead`, `pk-actions`/`pk-est`, `pk-item`/`pk-drop`, `pk-round`/`pk-chip`, `hd-val`, `hd-est`. Aucune classe locale de ReactionBar : seules les classes `sk-rbar*` du bundle sont utilisées.
