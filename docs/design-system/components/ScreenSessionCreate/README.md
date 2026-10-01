Création de session : dialog « Nouvelle session » ouvert depuis la page Sessions, avec choix du type puis réglages propres au type (rétro, poker).

**But** — Lancer une session en moins de 30 s avec de bons défauts, tout en exposant les réglages clés avant l'ouverture. EN puis FR, variante rétro puis variante poker.

**Zones**
- **Fond** : sidebar déployée (`active='sessions'`), page Sessions (onglets, liste) sous `sk-overlay` ; le bouton « Nouvelle session » garde l'anneau de focus (retour du focus à la fermeture).
- **En-tête** : titre, « Équipe Atlas · le lien d'invitation est créé tout de suite », fermer.
- **Type** (`radiogroup`, 5 tuiles) : Rétro (`sk-c-coral`, `sticky-note`), Poker (`moss`, `spade`), Whiteboard (`sky`, `pen-tool`), Sondage (`iris`, `chart-column`), Icebreaker (`sun`, `party-popper`) — mêmes couleurs que les SessionCard.
- **Rétro — colonne gauche** : Nom ; Modèle (Start · Stop · Continue, 4L, Glad · Sad · Mad, Voilier, modèle d'espace « Rétro Atlas v3 », Parcourir) avec bande des couleurs de colonnes ; **aperçu des colonnes** en mini-board (pastille, nom, description, cartes fantômes, poignée de réordonnancement), colonne sélectionnée cerclée et sa palette de 8 couleurs.
- **Rétro — colonne droite** : Réglages en lignes (`sc-opt`) — cartes anonymes, votes par personne et max par carte (steppers), timer par phase, icebreaker au début (+ jeu), health check, ROTI ; Invitation (lien en mono + Copier, invités anonymes autorisés).
- **Poker — gauche** : Nom ; Deck (Fibonacci, T-shirt intégrés ; decks sauvegardés « Atlas · heures », « Puissances de 2 » ; « Nouveau deck ») et aperçu des valeurs (`?` et ☕ en `muted`) ; Tâches : onglets Importer de Jira / Saisie manuelle / Plus tard, JQL en mono, liste de tickets à cocher (`sk-ticket`), « 9 sur 12 sélectionnés · Tout sélectionner ».
- **Poker — droite** : révélation auto, facilitateur en « Watch only », timer par tâche, revoter après révélation, écriture de l'estimation dans Jira (champ), note d'info, invitation.
- **Pied** : « Enregistrer comme modèle d'équipe » (rétro) ou « Planifier… » (poker), Annuler, **Créer et ouvrir**.

**Composants** : Sidebar, Dialog, RadioGroup (tuiles), Input, Select, Switch, Checkbox, Tabs, Badge, Alert, Button, ticket (`sk-ticket`), PhaseStepper (phases réglées par le timer : Icebreaker → Écriture → Regroupement → Vote → Discussion → Actions → ROTI).

**Comportement** — Le choix du type remplace la colonne gauche et les réglages (animation `duration-base`), le nom est pré-rempli (« Rétro sprint 43 », sprint suivant) ; Entrée = Créer et ouvrir ; les réglages restent modifiables dans la session. Le dialog fait 61rem et défile en interne si la fenêtre est basse (en-tête et pied collants).

**Mobile** — Plein écran (Drawer à 100 %) : type en liste horizontale défilante, colonnes gauche/droite empilées, pied collant.

**Classes locales** : `.sc-type`, `.sc-tpl` (+ `.sc-strip`), `.sc-mini` / `.sc-mcol` (aperçu de colonnes), `.sc-sw`, `.sc-opt` (ligne de réglage), `.sc-step` (stepper), `.sc-val`, `.sc-issue`.
