Paramètres utilisateur (desktop 1440, EN puis FR) en scroll long : une page par sous-nav dans l'app, montrées ici empilées pour revue.

**Zones**
- Sidebar de l'app (menu utilisateur actif), topbar, titre « Settings ».
- Sous-nav verticale collante : Profile (actif), Security, Appearance, Notifications, API tokens.
- **Profile** : avatar xl + 12 couleurs de présence (`sk-p1…12`, sélection en anneau), Upload photo / Use initials, Name, Email (badge Verified), pied de carte avec aide + **Save**.
- **Delete account** : carte à bordure destructive teintée, icône triangle-alert en `skrum-destructive-soft`, libellé + conséquences, bouton `sk-btn--destructive` avec icône (jamais un bouton seul sans contexte).
- **Appearance** : thème System / Light / Dark en cartes radio avec aperçu réel (mini-UI rendue avec `data-theme="light|dark"` imbriqué, System = moitié/moitié), langue English / Français (segmenté), switch Reduce animations.
- **Notifications** : table d'événements, switches In-app / Email par ligne.
- **API tokens** : nom, expiration, scopes (cases + code mono + description), état « token created » affiché une seule fois (`skrum-success-soft`, champ mono + Copied), Create token ; table des jetons (scopes, dernière utilisation, expiration, Revoke ; jeton révoqué barré).

**Composants** — sk-nav-item, Card, Input, Select, Checkbox, Radio, Switch, sk-tabs, Table, Badge, Button, sk-avatar.

**Mobile** — sous-nav en liste de premier niveau puis page dédiée (retour) ; cartes de thème en 3 colonnes compactes (aperçu réduit) ; table de notifications en lignes « libellé + 2 switches » ; table des jetons en cartes.

**Classes locales** — `us-theme`/`us-mini` (carte radio de thème avec aperçu), `us-sw` (pastille de couleur de présence), `us-danger-row`, `us-once`/`us-token` (secret affiché une fois), `us-code` (scope).
