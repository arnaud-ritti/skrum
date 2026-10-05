Board de rétrospective en phase Écriture (desktop 1440×900) : chacun écrit en silence, les cartes des autres restent masquées.

**Zones**
- Sidebar repliée (48 px, icônes).
- Topbar : équipe/sprint + nom de session, PhaseStepper (Écriture active), Timer (`--p` = progression), PresenceStack (avatar « en train d'écrire » cerclé), Partager.
- Bandeau d'aide : rappel de l'écriture silencieuse + compteur « 16 cartes · 6/8 ont écrit ».
- 4 RetroColumn (Bien passé `moss`, À améliorer `coral`, Idées `sun`, Remerciements `plum`), largeur fluide 300–340 px.
  - Mes cartes visibles + mention « Visible par toi » ; une carte anonyme à moi ; une carte en édition (`is-editing`, raccourcis ↵ / Esc, compteur).
  - Cartes des autres en `is-masked` (longueurs variées pour donner le rythme).
  - « Inès écrit une carte… » (sk-typing + sk-trema à la couleur de présence).
- LiveCursor des autres participants.
- FacilitatorBar flottante centrée en bas : Pause, +2 min, anonymat, Révéler les cartes, phase suivante.

**Temps réel** — le compteur, les cartes masquées et les indicateurs de saisie arrivent par websocket ; la révélation retourne les cartes (`--duration-flip`).

**Mobile** — une colonne à la fois avec onglets de colonnes ; FAB « Ajouter une carte » ; la FacilitatorBar devient un Drawer ; curseurs masqués.
