Pages et états d'erreur (desktop 1440, EN puis FR) : 404, 403, 500, maintenance d'instance et connexion perdue en session.

**But** — dire ce qui se passe et quoi faire, sans jargon ni « Oups ! ». Chaque vue donne une action principale et rassure sur les données (« Tes cartes et tes actions sont intactes »).

**Zones (pages pleines : 404, 403, 500, 503)**
- En-tête : logo (ou logo de l'instance en white-label), liens « État de l'instance » et « Aide ».
- Centre (`max-w-124`, texte centré) : illustration géométrique post-it + tréma (`sk-empty-art` agrandi, couleurs de colonnes, pas de personnage), sur-titre `text-overline text-skrum-primary-text` (« Erreur 404 »), titre `text-xl font-title`, description `text-muted-foreground`, actions.
- Pied : nom d'instance + version.
- **404** : « Retour à mes équipes » (primaire), « Rechercher une session » (outline + `⌘K`).
- **403** : bloc équipe (pastille, nom, espace), compte connecté en gras, champ message facultatif, « Demander l'accès » (primaire), « Changer de compte » (ghost), admins de l'équipe. Après envoi : toast + bouton remplacé par « Demande envoyée » désactivé.
- **500** : identifiant d'erreur copiable (`font-mono`, horodatage UTC, bouton « Copier » → « Copié » 2 s), « Réessayer » + « Retour à mes équipes ». L'identifiant = l'ID de requête loggé côté Laravel (`X-Request-Id`), jamais une trace.
- **Maintenance (503)** : bloc « Retour prévu » (`skrum-info-soft`, heure en display, fuseau + délai), message de l'admin (réglage d'instance, facultatif), loader `sk-trema` « Cette page se recharge toute seule », bouton « Réessayer maintenant ». Rendu par la vue `errors::503` de `php artisan down --render` ; l'heure vient de `--retry`.

**Connexion perdue en session** — jamais de page ni de modale :
- `ConnectionState` (`sk-conn is-lost`) dans la topbar + **bandeau** pleine largeur sous la topbar (`role="status"`, `aria-live="polite"`) : « Connexion perdue — tes cartes sont gardées, on se reconnecte… », compte à rebours, « Réessayer maintenant ».
- Trois états : reconnexion (`skrum-warning-soft`), hors ligne prolongé > 60 s (`skrum-destructive-soft`, wifi-off), rétabli (`skrum-success-soft`, disparaît après 4 s).
- Le board reste utilisable : les cartes écrites partent en file locale (bordure pointillée + « En attente d'envoi »), vote, révélation et timer sont en pause.

**Composants** — Button, Input, Field, Badge, Avatar/PresenceStack, `sk-team-mark`, `sk-trema`, ConnectionState, RetroColumn, RetroCard, Sidebar repliée (générée).

**Classes locales à promouvoir** — `.er-banner` (+ `--warning|--error|--success|--card`) : bandeau de connexion sous la topbar ; `.er-id` : champ identifiant copiable ; `.er-art` : illustration d'erreur 10 × 6.875rem.

**Tailwind** — bandeau : `flex items-center gap-3 px-4 py-2 text-body-sm bg-skrum-warning-soft text-skrum-warning-text border-b`; illustration `w-40 h-27.5`; identifiant `font-mono text-body-sm rounded-md border border-input bg-muted`.

**Mobile** — pages d'erreur en une colonne (padding `p-4`), actions empilées pleine largeur ; bandeau de connexion sous la barre d'en-tête, texte sur deux lignes, bouton icône seul (`aria-label`).
