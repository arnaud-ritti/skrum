Nouveau jeu d'icebreaker « Sprint in one GIF » / « Le sprint en un GIF » : chacun choisit un GIF qui résume son sprint, puis galerie de révélation, votes, réactions et gagnant.

**But** — Ouvrir la rétro sur le ressenti du sprint de façon légère ; le GIF gagnant peut être épinglé à la rétro. EN puis FR, deux étapes par langue.

**Étapes** : 1. Choix du GIF (chrono 2 min) → 2. Révélation & votes (GIF révélés un par un, 2 votes par personne, auteurs cachés jusqu'à la fin des votes) → 3. Gagnant.

**Zones — étape 1 (choix)**
- **Gauche** : participants avec statut (« GIF choisi » / « choisit… » avec loader tréma), progression `3 / 6 prêts`, déroulé des étapes, réglages (thème, votes, auteurs cachés).
- **Scène** : consigne (« Quel GIF résume ton sprint 42 ? ») puis **GifPicker ouvert** (recherche « vendredi », catégories, masonry, tuile sélectionnée, survol, « Powered by GIPHY »).
- **Droite — Ton choix** : aperçu avant envoi (tuile, titre, méta), légende 60 car. avec compteur, « Envoyer mon GIF » / « Changer », badge Brouillon ; GIF déjà envoyés par les autres **cachés** (`eye-off` + avatar).

**Zones — étape 3 (résultats)**
- **Gauche** : budget de votes `2 / 2 utilisés` (`sk-vote-budget`), qui a voté, déroulé.
- **Scène** : galerie 3 colonnes de cartes GIF (auteur, nb de votes, légende, `sk-reactions`, `sk-vote-btn` cœur `is-mine`), carte gagnante cerclée `--primary` + étiquette « Gagnant » couronne ; badge « Votes clos ».
- **Droite** : « Le GIF du sprint » (trophée, « Malik remporte la manche »), classement 2–6 avec ex aequo, actions « Épingler à la rétro du sprint 42 », « Nouvelle manche », copier le lien.
- **ReactionBar** dockée bas-centre de la scène dans les deux étapes.

**Composants** : Sidebar (repliée, `active='games'`), GifPicker, Timer, Progress, Avatar, Badge, Input, Button, VoteDots (`sk-vote-budget`, `sk-vote-btn`), RetroCard (`sk-reactions`), Select, Switch, ReactionBar.

**Règles** — GIF en `<video autoplay muted loop playsinline>` (mp4/webp via proxy Laravel) ; `prefers-reduced-motion` : image fixe, lecture au survol/clic ; alt = titre du GIF + légende. Jeu masqué si l'admin a désactivé GIPHY.

**Mobile** — Étape 1 : GifPicker en Drawer plein écran, aperçu en bas ; étape 3 : galerie 1 colonne en défilement, vote au double-tap ou bouton cœur.

**Classes locales** : `.gf-step`, `.gf-prompt`, `.gf-hidden` (GIF caché), `.gf-card` / `.is-win` / `.gf-win-tag`, `.gf-gal`, `.gf-podium`, `.gf-rank` — plus `.g-*` et `.gp-*` (GifPicker).
