Salle d'icebreaker « Dessin à deviner » (EN : Pictionary) : un joueur dessine un mot secret, les autres devinent dans le chat avant la fin du chrono.

**But** — Faire rire et parler toute l'équipe en 10 min, invités anonymes compris ; montrer les deux points de vue d'une même manche (dessinateur, devineurs), en EN puis en FR.

**Zones** (grille identique à ScreenIcebreaker : sidebar repliée `active='games'`, colonnes 300 px · scène · 340 px)
- **Topbar** : retour aux jeux, nom de la salle, badge du jeu, manche `3 / 6`, `sk-stack` des joueurs, Inviter, réglages, avatar.
- **Colonne gauche — Joueurs** : classement (`g-player`, dessinateur surligné `is-turn`, « trouvé · 0:18 » en `--skrum-success-text`), ordre de dessin, carte de réglages (liste de mots, temps par tour, indices auto).
- **Scène** : manche + `sk-timer--lg` du tour ; carte du mot — *dessinateur* : mot en clair « toi seul le vois » + « Autre mot (1) » ; *devineurs* : mot à trous en `sk-letter`, lettre d'indice en `--skrum-primary-text`, « prochaine lettre dans 0:12 ». Zone de dessin `--card` (traits = tokens `-text` des colonnes, donc lisibles en clair et en sombre), crayon live avec étiquette de présence côté devineurs.
- **Barre d'outils** (dessinateur seulement, `sk-wbbar` horizontale) : Crayon (P), Gomme (E), 3 épaisseurs, Encre + **8 couleurs de colonnes** (`sk-c-*` → `--c-t`), Annuler (⌘Z), Rétablir, Effacer.
- **Colonne droite — Propositions** (`role="log"`, `aria-live="polite"`) : propositions des joueurs, ligne système « Inès a trouvé ! +120 » (`--skrum-success-soft`), **« Presque ! »** (`--skrum-warning-soft`) visible par le dessinateur et, côté devineur, seulement pour sa propre proposition (« Un des deux mots est juste »). Bloc « Trouvé par · 2 / 5 ». Dessinateur : chat en lecture seule ; devineur : champ + « Proposer ».
- **ReactionBar** dockée bas-centre de la scène (`sk-rbar-dock`), sous la barre d'outils sans chevauchement.

**Composants** : Sidebar (repliée), IcebreakerGameCard (choix en amont), Timer, PresenceStack, Avatar, Badge, Select, Switch, Input, Button, WhiteboardToolbar (`sk-wbbar`, `sk-tool`), LiveCursor (`sk-cursor-tag`), ReactionBar.

**Temps réel** — Traits diffusés en segments (canal présence de la salle), throttle 30 ms ; le mot n'est jamais envoyé aux devineurs (seulement sa longueur et les lettres d'indice). La comparaison « Presque ! » se fait côté serveur (distance de Levenshtein ≤ 2 ou un mot sur deux juste, accents ignorés).

**Mobile** — Devineurs : dessin plein largeur, chat en Drawer, champ de proposition collé au clavier. Dessinateur : barre d'outils en bas (couleurs dans un Popover), mot secret en bandeau.

**Classes locales** (candidates à `bundle.css`) : `.g-grid / .g-side / .g-right / .g-stage` (grille de salle de jeu partagée par les 3 jeux), `.g-player`, `.dr-word`, `.dr-blanks`, `.dr-canvas`, `.dr-sw` (pastille couleur de dessin), `.dr-size`, `.dr-msg.is-close`, `.dr-sys`.
