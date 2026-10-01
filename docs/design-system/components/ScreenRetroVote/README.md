Board de rétrospective en phase Vote (desktop 1440×900) : cartes révélées et regroupées, chacun dépense son budget de votes.

**Zones**
- Topbar identique à l'écriture, PhaseStepper sur Vote (Écriture et Regroupement cochés).
- Barre de vote : VoteBudget « 2 votes restants » (5 VoteDots dont 3 pleins, règle « max 2 par carte »), badge info « Votes masqués jusqu'à la révélation », avancement « 5/8 ont terminé ».
- 4 colonnes révélées : CardGroup (`sk-group`, titre + compteur, vote de groupe) et cartes isolées ; mes votes = VoteDots pleins + `sk-vote-btn.is-mine` ; pas de total affiché avant révélation ; réactions emoji conservées.
- LiveCursor (Lucas, Camille, Yuki).
- FacilitatorBar : +2 min, réglage votes/personne, Révéler les votes, Discussion →.

**Comportement** — cliquer « Voter » ajoute un point (pop `--ease-spring`) ; re-cliquer sur un VoteDot le retire ; à budget épuisé les boutons passent `is-disabled`. À la révélation, les totaux s'affichent et les colonnes peuvent être triées par votes.

**Mobile** — une colonne à la fois, budget collé en haut, bouton de vote 44 px.
