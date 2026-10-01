Workspace (desktop 1440, EN puis FR) : sélecteur de workspace ouvert, page workspace avec ses équipes et sortie du workspace, puis page Templates partagés — 4 frames : workspace EN, FR, templates EN, FR.

**Workspace (frames a, b)**
- Sélecteur ouvert (`sk-menu` sous le déclencheur de la sidebar, déclencheur en anneau `--ring`) : label Workspaces, entrées avec pastille, nombre d'équipes et rôle, check sur l'actif, raccourcis ⌘2/⌘3, séparateur, **New workspace**.
- En-tête : pastille N, « Nordlys », équipes · membres · rôle ; Invite people, **New team**.
- Équipes en cards (grille `auto-fill minmax(15.5rem)`) : pastille couleur de colonne, nom, description, 3 lignes d'activité (rétro live en `skrum-success-text`, parties actives, actions ouvertes / en retard), pile de membres + total, « Open → » ; tuile pointillée **New team**.
- **Leave workspace** en zone discrète en bas (séparateur, texte muted, bouton ghost texte destructive) ; confirmation destructive dépliée inline (`role="alertdialog"`) : conséquences en liste, saisie du nom pour confirmer, bouton `sk-btn--destructive` + Cancel.

**Templates (frames c, d)** — « Templates shared by every team of this workspace » ; onglets All / Retro · 4 / Poker · 2 / Whiteboard · 0, recherche, New template ; cartes de template rétro (aperçu des colonnes en couleurs `sk-c-*`, nb de colonnes, usage, auteur, **Use**), poker (aperçu des valeurs du deck, réglages), whiteboard en **état vide** (« No whiteboard templates yet. » + action).

**Composants** — sk-sidebar, sk-menu, sk-menu-item, sk-shortcut, Card, sk-stack, Button, Input, sk-tabs, sk-empty.

**Mobile** — sélecteur en Drawer plein écran ; équipes et templates en 1 colonne ; confirmation de sortie en Dialog.

**Classes locales** — `ws-menu`, `ws-team`, `ws-newteam`, `ws-confirm`, `tp-prev`/`tp-col` (aperçu de colonnes), `tp-deckprev`/`tp-v`, `tp-empty`.
