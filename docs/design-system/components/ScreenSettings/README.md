Paramètres en deux niveaux : réglages d'une équipe (membres, rôles, rituels) et administration d'une instance self-host (marque, SSO, email, intégrations, accès MCP, licence).

**But** — (a) Permettre au propriétaire/facilitateur de gérer qui fait quoi et les valeurs par défaut des rituels. (b) Donner à l'admin d'instance tout ce qu'il faut pour brancher Skrüm dans son SI, sans casser l'accessibilité de la marque.

**a) Paramètres d'équipe (frame 1440×900)**
- Sidebar app (Paramètres actif), en-tête d'équipe + onglets segmentés (Général, Membres & rituels, Intégrations, Données & export).
- **Membres** (`sk-table` dans une carte) : avatar présence, email, rôle en `sk-select` (Propriétaire, Facilitateur·rice, Membre, Observateur·rice), dernière activité, invitation en attente (badge warning + Renvoyer). Pied : définition des rôles.
- **Facilitateurs par défaut** : chips retirables + switch de rotation automatique avec prochain·e facilitateur·rice.
- **Modèles de rétro** : radio du modèle par défaut, aperçu des couleurs de colonnes, usage.
- **Colonnes par défaut** : colonnes réordonnables teintées `sk-c-*`, colonne sélectionnée cerclée `--ring`, palette des 8 couleurs nommées (Soleil, Abricot, Corail, Prune, Iris, Ciel, Lagon, Mousse).

**b) Admin d'instance (frame 1440×1770, scroll long)**
- Sidebar admin dédiée (retour à l'app, sections Général, Branding, Authentification SSO, SMTP, Intégrations, Clés MCP, Licence, Utilisateurs, Journal d'audit ; version de l'instance en pied). Topbar : domaine, badge Self-host, modifications non enregistrées, Annuler / Enregistrer.
- **Branding** : upload du logo, nom affiché, couleur primaire avec badge de contraste « AA · OK 5,1:1 » et garde-fou « Trop clair, ajusté automatiquement » (avant → après), arrondis (segmenté), **aperçu live** (barre, bouton primaire, carte avec switch et lien, carte de colonne) avec bascule Clair/Sombre. La couleur de marque ne remplace que primaire, focus et liens ; colonnes et présence restent fixes.
- **SSO / OIDC** : issuer, client ID, secret masqué (œil), URI de redirection en lecture seule + copie, secours par email, résultat de test (`sk-alert--success`), « Tester la connexion ».
- **SMTP** : hôte, port, chiffrement, utilisateur, mot de passe masqué, expéditeur, envoi d'un email de test + dernier résultat.
- **Intégrations** : Slack, Jira, Linear avec switch, état « Connecté · … » en `--skrum-success-text` ou « Non connecté » + Connecter.
- **Licence** : édition, sièges (`sk-progress`), expiration.
- **Clés MCP** : table nom + empreinte masquée, portées en `code`, créée (date · auteur), dernière utilisation, Révoquer (texte destructif) ; ligne révoquée barrée et grisée.

**Composants** : Sidebar, Table, Select, Input, Switch, Radio, Tabs, Badge, Alert, Progress, Button, Avatar, RetroCard (aperçu).

**Mobile** — Paramètres d'équipe en une colonne (membres en liste avec rôle dans un Drawer). Admin : navigation latérale → Select « Section » en haut ; aperçu Branding sous le formulaire ; tables MCP en cartes empilées. L'admin reste pensé desktop d'abord.

**Classes locales** (candidates à `bundle.css`) : `.st-card` + `-h/-b/-f` (carte de réglages avec pied grisé), `.st-pal` / `.st-sw` (sélecteur des 8 couleurs de colonnes), `.st-guard` (garde-fou de contraste), `.st-prev` (aperçu de marque via `--brand`/`--brand-fg`), `.st-int` (ligne d'intégration), `.st-scope` (portée d'API), `.st-tpl` (modèle radio).

**Note tokens** — La couleur de marque personnalisée est simulée par `--skrum-info` / `--skrum-info-foreground` (pas de hex en dur) ; en production elle est injectée comme `--primary` avec une variante sombre dérivée.
