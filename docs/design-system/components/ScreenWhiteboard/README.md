Whiteboard collaboratif plein écran : un canvas infini partagé en temps réel pour cartographier, trier et relier des idées.

**But** — Atelier libre (cartographie de parcours, story mapping, brainstorm) avant ou après une rétro ; les post-its sélectionnés peuvent être convertis en actions.

**Zones**
- **Topbar** (`sk-topbar`, 56 px) : logo, fil d'Ariane éditable, état de synchro (`sk-conn is-ok`), présence (`sk-stack`, anneau `is-typing` à la couleur de présence), commentaires, Exporter, Partager (primaire).
- **Canvas** (`sk-dotgrid`, z `--z-board`) : calque SVG inline (formes `rect`/losange/pilule, connecteurs avec `marker-end`, tracé crayon en `--skrum-destructive-text`), titres, zones/cadres, post-its `sk-sticky sk-c-*`.
- **Sélection** : cadre 1,5 px `--ring`, 8 poignées, compteur « 3 éléments » ; barre contextuelle (`sk-wbbar`) avec les 8 couleurs de colonnes, grouper, aligner, verrouiller, convertir en actions, supprimer.
- **Curseurs live** (`sk-cursor`, `--cur` = présence) ; post-it verrouillé en édition par Inès (anneau + étiquette + `sk-trema`).
- **Chrome** (z `--z-chrome`) : `WhiteboardToolbar` verticale à gauche (`sk-wbbar--v`, `sk-tool` + raccourci), historique en bas à gauche, zoom + `sk-minimap` en bas à droite.

**Composants** : WhiteboardToolbar, LiveCursor, PresenceStack, ConnectionState, Button, Breadcrumb, Avatar.

**Mobile** — Lecture et annotation légère : toolbar repliée en barre basse horizontale (outils Sélection, Post-it, Crayon + « … »), minimap masquée, zoom au pinch, présence réduite à un compteur. Pas de création de connecteurs sous 768 px.

**Classes locales** (candidates à `bundle.css`) : `.wb-sel` + `.wb-h` (cadre de sélection et poignées), `.wb-swatch` (pastille de couleur de colonne), `.wb-shape*` / `.wb-conn` / `.wb-pencil` (styles SVG tokenisés), `.wb-zone`.
