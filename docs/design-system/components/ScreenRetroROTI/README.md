Fin de rétro (desktop 1440, EN puis FR) : vote ROTI anonyme, puis écran de clôture qui récapitule la session.

**Frame ROTI (a EN, b FR)**
- PhaseStepper 7/7 sur ROTI, timer `is-low` 00:48.
- `ROTIWidget` agrandi : question, 5 notes (4 « Utile » sélectionnée), « Vote enregistré · modifiable jusqu'à la fin », bloc **votes masqués** (barre rayée + 5 compteurs « ? ») tant que le facilitateur n'a pas terminé.
- Carte « Qui a voté » 6/8 : progression `--skrum-success`, liste des participants (A voté / Réfléchit avec tréma, invité anonyme en avatar `--guest`) ; jamais la note de chacun.
- Dock : `ReactionBar` au-dessus de la `FacilitatorBar` (écart `space-3`) : Relancer les 2 derniers, Révéler le ROTI, **Terminer la session**.

**Frame fin de session (c EN, d FR)**
- Topbar : toutes les phases cochées + badge « Terminée ».
- En-tête : « Session terminée · 58 min », titre, promesse « Les réunions se terminent, les actions restent. », boutons Retour à l'équipe (ghost), Exporter (menu PDF / CSV / Markdown / Jira), **Envoyer le récap par e-mail** (primaire).
- 5 stats réelles : actions créées, participation 8 sur 9, cartes, groupes, votes exprimés.
- Actions créées (6 `ActionItem` : responsable, échéance, priorité, ticket Jira, sujet d'origine).
- ROTI moyen 3,8/5 + écart vs S41, répartition empilée `--skrum-roti-*`, tendance compacte (`MoodTrendChart` en version sparkline S35 → S42, seuil « 3 · correct »).
- Health check (si collecté) : 6 énoncés intégrés, score, écart vs rétro précédente, alerte `--skrum-warning` sous 3.
- `ReactionBar` seule, docké bas-centre, sans chevaucher les cartes.
- Confettis figés : une salve, 24 éclats (post-its à coin arrondi et paires de points tréma) aux couleurs des colonnes de la session (`--skrum-col-*-border`), cantonnés au bandeau supérieur pour ne pas passer sous le texte. Animation réelle `animate-confetti` 1400 ms puis fondu, jamais en boucle ; `prefers-reduced-motion` → pas de confettis, toast « Session terminée — 6 actions créées ».

**Composants** — Sidebar, PhaseStepper, Timer, ROTIWidget, PresenceStack, ActionItem, MoodTrendChart, HealthCheck, ReactionBar, FacilitatorBar, Button, Badge.

**Mobile** — ROTI : les 5 notes en cibles 44 px sur toute la largeur, « Qui a voté » réduit à une pile d'avatars. Fin : stats en grille 2 colonnes, actions puis ROTI puis health check empilés, boutons en pied collant (e-mail primaire, Exporter et Retour dans un menu).
