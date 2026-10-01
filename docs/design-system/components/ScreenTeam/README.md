Page équipe designée (desktop 1440, EN puis FR) : remplace la liste brute actuelle de l'app par un hub d'équipe qui lance et retrouve tous les rituels.

**Zones**
- Sidebar de l'app réelle : sélecteur de workspace (Nordlys), Platform → Teams (sous-liste Atlas / Borealis / Comet), Action items (badge 7), Templates, Workspace ; aide ; menu utilisateur.
- Topbar : fil d'Ariane Nordlys › Teams › Atlas, recherche ⌘K, notifications.
- En-tête : pastille d'équipe (couleur de colonne coral), « Atlas », pile de présence, membres, workspace, prochaine rétro ; raccourcis **Open action items (7)** (compteur en `sk-badge--soft`), **Games**, réglages.
- 4 tuiles de création : rétro, poker, whiteboard, sondage (pastille `sk-c-*`, titre qui peut passer sur 2 lignes en FR).
- Retrospectives : grille de SessionCard (`.sk-session`) avec badge de phase — Writing (`--info` + point live), Voting (`--warning`), Closed (`--muted`) ; méta participants / cartes / actions ; pied « Join / Resume / Summary ».
- Planning poker : liens Estimation history / Saved decks, New game ; table « Active games » (nom + « n tasks · n estimated », deck en badge outline, points, dernière activité, Join/Open).
- Whiteboards : vignette `sk-dotgrid` + post-its, nom, « Facilitated by … · date ».
- Colonne droite : Health check compact (6 énoncés intégrés, libellé court + énoncé + badge Built-in, note « Changes apply… », lien Manage) ; Members (avatar présence, email, rôle Facilitator).

**Composants** — sk-sidebar, sk-nav-item, sk-team, sk-topbar, sk-crumbs, Button, Badge, Card, SessionCard (`sk-session`), Table, sk-stack, sk-avatar, sk-sticky, sk-dotgrid.

**Responsive / mobile** — `tm-grid` (contenu + aside 22.5rem) passe en une colonne sous ~64rem, Health check et Members sous les sections ; tuiles en 2×2 puis 1 colonne (`auto-fit minmax(14rem)`) ; SessionCard en `auto-fill minmax(19rem)` ; la table des parties devient une liste de cartes (nom, progression, bouton) sous 40rem ; sidebar en Sheet.

**Classes locales** — `tm-tile`, `tm-hc-row`, `tm-member`, `tm-board`/`tm-thumb` ; nav : `scr-sub`/`scr-subitem`/`scr-tmark` (sous-liste d'équipes dans la sidebar).
