Liste globale des actions de l'équipe : tout ce qui est sorti des rétros, sondages et whiteboards, filtrable, groupé et synchronisable avec Jira / Linear.

**But** — Tenir la promesse « les actions restent » : voir d'un coup d'œil ce qui traîne (retards), qui porte quoi, et traiter en masse (statut, assignation, échéance, envoi vers le tracker).

**Zones**
- **Sidebar app** (`sk-sidebar`, item Actions actif avec badge « 4 en retard ») + **topbar** : recherche `⌘K`, Exporter, Nouvelle action.
- **En-tête** : titre, compteurs réels, contrôle segmenté « Grouper par » Sprint / Équipe / Responsable / Aucun (`sk-tabs`).
- **Filtres** (`.ac-filter`, style shadcn « faceted filter » pointillé → plein quand actif) : Équipe, Statut, Responsable, Priorité, Échéance, Source, raccourci « En retard » avec compteur, Réinitialiser.
- **Table** (`sk-table` dans une carte) : case à cocher (en-tête `is-mixed`), action + source (rétro, whiteboard, sondage), statut en badge, responsable (avatar présence), `sk-prio`, échéance (`sk-due is-late` pour les retards, avertissement ambre à J-3), ticket `sk-ticket` avec marque Jira (carré) ou Linear (rond) et icône de synchro, menu ligne. Lignes de groupe par sprint repliables avec badge d'état et compteur de retards. Lignes sélectionnées `is-selected`, faites barrées.
- **Barre d'actions groupées** flottante (z `--z-chrome`, `--shadow-modal`) : compteur, Statut, Assigner, Échéance, Priorité, Synchroniser vers Jira, Supprimer, désélectionner.

**Composants** : ActionItem (mêmes statuts, priorités, tickets), Table, Checkbox, Tabs, Badge, Avatar, Input, Button, Sidebar.

**Mobile** — La table devient une liste d'`ActionItem` groupée par sprint ; filtres dans un Drawer (bouton « Filtres · 2 ») ; appui long pour entrer en sélection multiple, barre groupée ancrée en bas au-dessus de la zone home, réduite à 3 actions + « … ».

**Classes locales** (candidates à `bundle.css`) : `.ac-filter` (filtre à facettes), `.ac-bulk` (barre d'actions groupées), `.ac-mark--jira` / `.ac-mark--linear` (marques d'intégration), `.ac-grp` (ligne de groupe de table).
