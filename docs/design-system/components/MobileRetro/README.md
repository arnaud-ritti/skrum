Maquettes mobiles 390×844 du board de rétrospective : phases Écriture, Vote et Actions.

**Zones**
- En-tête : retour, titre + sous-titre de phase, présence, `sk-phases.is-compact` (seule la phase courante porte son libellé).
- Onglets de colonnes colorés (`ctab` + `sk-c-*`, 44 px) + indicateur de pagination : **une colonne par écran, on swipe entre colonnes**.
- *Écriture* : mes cartes lisibles, celles des autres `is-masked`, indicateur « Théo écrit » (`sk-trema`), bouton + flottant (56 px) qui ajoute dans la colonne active, FacilitatorBar compacte dockée en bas (rôle, timer, Révéler, phase suivante).
- *Vote* : budget collant (`sk-vdot`), stepper −/+ de 44 px par carte ou groupe (`sk-group`), totaux masqués, « J'ai terminé de voter ».
- *Actions* : sujets les plus votés + **Drawer** d'ajout (texte, responsable en chips d'avatar, priorité segmentée, échéance, création de ticket Jira).

**Choix mobiles**
- Colonnes → onglets swipables (jamais de scroll horizontal de colonnes à 280 px).
- Popover / Sheet desktop → `sk-drawer` plein largeur ancré en bas, fermeture par grip, croix ou tap sur le voile.
- `sk-vote-btn` (28 px) remplacé par un stepper 44 px ; les VoteDots restent la lecture du budget.
- FacilitatorBar réduite à 4 contrôles, les options avancées passent dans « … ».

**Composants** : RetroColumn, RetroCard, CardGroup, VoteDots, PhaseStepper, FacilitatorBar, Timer, PresenceStack, Drawer, ActionItem, Switch.
