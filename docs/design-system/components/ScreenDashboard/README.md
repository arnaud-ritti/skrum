Tableau de bord d'équipe (desktop 1440) : point d'entrée « Équipe Atlas » — lancer une session, retrouver l'historique, suivre les actions et le moral.

**Zones**
- Sidebar déployée : logo, sélecteur d'équipe/organisation, nav (Tableau de bord actif, Sessions, Actions avec badge « 2 en retard », Moral & ROTI, Membres), groupe Modèles, paramètres, utilisateur.
- Topbar : fil d'Ariane, recherche ⌘K, notifications.
- En-tête : « Équipe Atlas », méta (membres, sprint, prochaine rétro), Inviter + Nouvelle session.
- 4 CTA de création (Rétro, Planning poker, Whiteboard, Sondage) avec pastille couleur de colonne.
- Sessions récentes (Table) : type, date, participants, statut (En direct → bouton Rejoindre, Terminée, Brouillon).
- Actions ouvertes agrégées : ActionItem en retard d'abord (`sk-due.is-late`, alarm-clock), ticket, rétro d'origine.
- Tendance du moral : courbe SVG inline ROTI S35→S42 (`--chart-1`, grille `--border`, étiquette de la dernière valeur), badge de variation.
- Activité : fil court (avatar présence + phrase + horodatage).

**Composants** — sk-sidebar, sk-nav-item, sk-team, sk-topbar, sk-crumbs, Input, Button, Card, Table, Badge, sk-action, sk-prio, sk-due, sk-ticket, sk-chart, sk-avatar.

**Mobile** — sidebar en Sheet via bouton menu ; CTA en grille 2×2 ; sessions en liste de cartes (pas de table) ; graph pleine largeur ; ordre : CTA → actions en retard → sessions → moral → activité.
