Sondage d'équipe de bout en bout : création par le facilitateur, réponse question par question, résultats agrégés partageables.

**But** — Mesurer le ressenti de l'équipe (charge, NPS, rituels, freins) en fin de sprint ou de rétro, anonymement par défaut, puis ramener les réponses libres vers le whiteboard ou la rétro.

**Vues (3 frames 1440×900 empilées)**
- **a) Création** — Sidebar app + topbar (brouillon, auto-save, Aperçu, Publier). Colonne d'édition : titre, liste de questions réordonnables (poignée `grip-vertical`, numéro, type en badge) ; la question sélectionnée s'ouvre (type en `sk-select`, libellé, bornes de l'échelle, aperçu `sk-scale`, Obligatoire en `sk-switch`). Barre « Ajouter » avec les 5 types (échelle 1-5, NPS, choix unique, choix multiple, texte libre). Panneau Réglages 340 px : anonymat (3 choix radio), une question à la fois, résultats après réponse, invités sans compte, clôture, seuil d'affichage.
- **b) Réponse participant** — Chrome minimal (logo, titre, badge « Réponses anonymes », avatar invité). Progression « Question 2 sur 5 » + segments, carte centrée 760 px : question en `--font-display`, NPS 0-10 (`sk-scale sk-nps`, valeur `is-on`), commentaire facultatif, Précédent / Suivant, raccourcis clavier, rappel d'anonymat.
- **c) Résultats** — Onglets Synthèse / Réponses libres / Comparer. Cartes : échelle (moyenne, mode, histogramme), NPS (score, barre détracteurs/passifs/promoteurs, répartition 0-10), choix unique et multiple (`sk-result`), texte libre en cartes colorées `sk-c-*` + mots-clés, action « Envoyer au whiteboard ». Données cohérentes : 9 réponses sur 11.

**Composants** : SurveyQuestion (`sk-scale`, `sk-opt`, `sk-result`), Sidebar, Tabs, Badge, Switch, Select, Button, Alert.

**Mobile** — (b) est la vue prioritaire mobile : carte pleine largeur, NPS en 2 lignes (0-5 / 6-10) avec cibles 44 px, boutons Précédent/Suivant collés en bas. (a) et (c) : panneau Réglages en Sheet, cartes de résultats en une colonne.

**Classes locales** (candidates à `bundle.css`) : `.sv-steps` (progression segmentée), `.sv-nps` + `.sv-nps-leg` (barre NPS empilée), `.sv-vbars` (histogramme vertical à étiquettes), `.sv-q` (carte question éditable), `.sv-ans` (réponse libre colorée), `.sv-kw` (mot-clé compté).
