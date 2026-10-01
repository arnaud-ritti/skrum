Maquettes mobiles 390×844 des rituels secondaires : whiteboard en lecture, sondage, icebreaker pendu.

**Zones**
- *Whiteboard* : canevas `sk-dotgrid` avec cadres, `sk-sticky`, flèche et curseur live (`sk-cursor`) ; pastilles « Lecture » et « Suivre Camille » ; **toolbar compacte** flottante en bas (déplacer, ajuster, réagir, commenter + « Modifier »).
- *Sondage* : progression (`sk-progress`, « Question 3 sur 8 »), catégorie, question en display, échelle 1–5 (`sk-scale`, options 60 px) avec ancres, commentaire facultatif, mention d'anonymat, navigation précédent / suivant en bas.
- *Icebreaker* : joueurs et scores en chips (tour courant cerclé), pendu SVG (tokens `--foreground` / `--muted-foreground`), mot en `sk-letter`, lettres ratées, clavier AZERTY tactile (`sk-key` 46 px, `is-hit` / `is-miss`).

**Choix mobiles**
- Sur téléphone, le whiteboard s'ouvre en lecture (pan / zoom au doigt) ; l'édition est explicite pour éviter les déplacements accidentels. La toolbar verticale desktop devient une barre horizontale de 4 outils 44 px.
- Le sondage affiche une question par écran ; les actions de navigation sont dans la zone du pouce.
- Le clavier du jeu remplace le clavier système (pas de champ texte) : pas de saut de mise en page, lettres jouées visibles.

**Composants** : WhiteboardToolbar, LiveCursor, SurveyQuestion, Slider/Progress, IcebreakerGameCard, Avatar, Badge.
