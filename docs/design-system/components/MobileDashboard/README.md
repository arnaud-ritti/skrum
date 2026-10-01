Maquettes mobiles 390×844 de l'espace d'équipe : dashboard, liste des actions et paramètres.

**Zones**
- *Dashboard* : sélecteur d'équipe (`sk-team-mark`), carte « En direct » avec reprise de session, 4 raccourcis de rituels (tuiles 56 px), « Mes actions ».
- *Actions* : filtres en chips horizontales défilantes (`m-chip`, cible 44 px via zone étendue), groupement par rétro d'origine, lignes `m-action` avec case 20 px dans une zone tactile 44 px, méta `sk-due` / `sk-prio` / `sk-ticket`.
- *Paramètres* : liste de sections façon réglages iOS (`m-list` / `m-li` 52 px), bloc « Instance » réservé à l'admin (`sk-badge--soft` Admin, états SSO/SMTP en badges), action destructive isolée.

**Choix mobiles**
- La `Sidebar` desktop devient une barre d'onglets basse à 4 entrées (Accueil, Sessions, Actions, Équipe).
- Les filtres de la table desktop deviennent des chips ; le tri/groupement passe dans un Drawer (bouton `arrow-down-wide-narrow`).
- Les pages de réglage sont des listes à pousser (chevron) plutôt que des formulaires longs.

**Composants** : Sidebar (→ tab bar), ActionItem, Badge, Checkbox, Avatar, PresenceStack, Card.
