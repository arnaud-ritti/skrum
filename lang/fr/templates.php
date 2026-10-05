<?php

return [
    'categories' => [
        'essentials' => 'Incontournables',
        'team_mood' => 'Équipe et humeur',
        'themed' => 'Thèmes et jeux',
        'ideas' => 'Idées et planification',
        'analysis' => 'Analyse',
    ],
    'went_well_to_improve_actions' => [
        'name' => "Ce qui a bien fonctionné, À améliorer, Idées d'action",
        'columns' => [
            ['title' => "Ce qui s'est bien passé", 'description' => 'Ce qui a fonctionné et mérite d’être répété volontairement au prochain sprint'],
            ['title' => 'À améliorer', 'description' => "Là où l'équipe a perdu de l'élan — des problèmes, pas des personnes"],
            ['title' => "Idées d'action", 'description' => 'Des étapes concrètes avec un responsable et une date, pas des intentions'],
        ],
    ],
    'start_stop_continue' => [
        'name' => 'Commencer, Arrêter, Continuer',
        'columns' => [
            ['title' => 'Commencer', 'description' => 'De nouvelles pratiques à essayer au prochain cycle'],
            ['title' => 'Arrêter', 'description' => 'Des habitudes qui gênent et doivent cesser maintenant'],
            ['title' => 'Continuer', 'description' => 'Ce qui fonctionne déjà et doit survivre au prochain changement'],
        ],
    ],
    'four_ls' => [
        'name' => 'Aimé, Appris, Manqué, Désiré',
        'columns' => [
            ['title' => "Ce que j'ai aimé", 'description' => 'Ce que tu as apprécié ou trouvé utile pendant la période'],
            ['title' => "Ce que j'ai appris", 'description' => 'Ce que tu sais maintenant et ne savais pas avant'],
            ['title' => 'Ce qui a manqué', 'description' => 'Ce qui manquait et a rendu le travail plus difficile'],
            ['title' => "Ce que j'aurais voulu", 'description' => "Ce que tu aimerais voir exister, même si ce n'est pas à nous de le construire"],
        ],
    ],
    'sailboat' => [
        'name' => 'Voilier',
        'columns' => [
            ['title' => 'Quel vent gonfle nos voiles et nous fait avancer vite ?', 'description' => 'Ce qui nous a fait avancer et que nous pourrions répéter volontairement'],
            ['title' => 'Quelles ancres nous retiennent ?', 'description' => 'Ce qui nous ralentit et nous freine à chaque sprint'],
            ['title' => 'Quels rochers devant nous menacent notre avenir ?', 'description' => 'Les risques à venir qui nous feront mal si rien ne change'],
            ['title' => 'Quelle est notre île idéale ?', 'description' => 'Le but vers lequel nous naviguons — mettez-vous d’accord dessus avant le reste'],
        ],
    ],
    'mad_sad_glad' => [
        'name' => 'En colère, Triste, Content',
        'columns' => [
            ['title' => 'En colère', 'description' => 'Ce qui t’a mis en colère — ce qui a mal tourné plus d’une fois'],
            ['title' => 'Triste', 'description' => 'Ce qui a déçu — des attentes jamais satisfaites'],
            ['title' => 'Content', 'description' => 'Ce qui s’est bien passé et mérite d’être protégé au prochain sprint'],
        ],
    ],
    'thumbs_up_down_ideas_recognition' => [
        'name' => 'Pouce en haut, Pouce en bas, Nouvelles idées, Reconnaissance',
        'columns' => [
            ['title' => 'Pouce en haut', 'description' => 'Ce qui s’est bien passé pendant ce sprint'],
            ['title' => 'Pouce en bas', 'description' => 'Ce qui a mal tourné ou a été frustrant'],
            ['title' => 'Nouvelles idées', 'description' => 'Des idées à essayer, même à moitié formées'],
            ['title' => 'Reconnaissance', 'description' => 'Des remerciements pour celles et ceux qui ont facilité le travail des autres'],
        ],
    ],
    'lean_coffee' => [
        'name' => 'Lean Coffee',
        'columns' => [
            ['title' => 'À discuter', 'description' => 'Les sujets proposés, classés par votes'],
            ['title' => 'En discussion', 'description' => 'Le seul sujet en cours en ce moment'],
            ['title' => 'Discutés', 'description' => 'Les sujets terminés — vérifie pour chacun s’il y a un engagement'],
        ],
    ],
    'original_four' => [
        'name' => 'Les 4 questions originales',
        'columns' => [
            ['title' => 'Qu’est-ce qui s’est bien passé ?', 'description' => 'Les réussites à nommer à voix haute, même petites'],
            ['title' => 'Qu’est-ce qui ne s’est pas si bien passé ?', 'description' => 'Problèmes et ratés — les faits, avant les raisons'],
            ['title' => 'Qu’ai-je appris ?', 'description' => 'Ce que tu transmettrais à quelqu’un qui commence le même travail'],
            ['title' => 'Qu’est-ce qui m’intrigue encore ?', 'description' => 'Les questions auxquelles l’équipe n’a pas encore répondu'],
        ],
    ],
    'starfish' => [
        'name' => 'Étoile de mer',
        'columns' => [
            ['title' => 'Continuer à faire', 'description' => 'Au bon niveau — à protéger quand nous sommes débordés'],
            ['title' => 'Faire moins', 'description' => 'Utile à petite dose, pas à supprimer'],
            ['title' => 'Faire plus', 'description' => 'Arrive déjà parfois et mérite une plus grande place dans la semaine'],
            ['title' => 'Commencer à faire', 'description' => 'Une nouvelle pratique à essayer — une ou deux par sprint, pas plus'],
            ['title' => 'Arrêter de faire', 'description' => 'N’apporte plus aucune valeur'],
        ],
    ],
    'three_little_pigs' => [
        'name' => 'Les trois petits cochons',
        'columns' => [
            ['title' => 'Maison de paille', 'description' => 'Ce qui pourrait facilement s’effondrer'],
            ['title' => 'Maison de bois', 'description' => 'Ce qui fonctionne mais pourrait être amélioré'],
            ['title' => 'Maison de briques', 'description' => 'Ce qui est solide et stable'],
        ],
    ],
    'dot_voting' => [
        'name' => 'Vote par points',
        'columns' => [
            ['title' => 'Sujets et idées', 'description' => 'Toutes les options envisagées — une carte par option, puis vote'],
        ],
    ],
    'speed_car' => [
        'name' => 'Voiture de course',
        'columns' => [
            ['title' => 'Moteur', 'description' => 'Qu’est-ce qui nous fait avancer plus vite ?'],
            ['title' => 'Parachute', 'description' => 'Qu’est-ce qui nous ralentit ?'],
        ],
    ],
    'happy_meh_sad' => [
        'name' => 'Content, Bof, Triste',
        'columns' => [
            ['title' => 'Content :)', 'description' => 'Les moments qui ont donné de l’énergie à l’équipe'],
            ['title' => 'Bof :|', 'description' => 'Ni bien ni mal — et c’est justement le signal'],
            ['title' => 'Triste :(', 'description' => 'Ce qui a épuisé l’équipe ou a clairement mal tourné'],
        ],
    ],
    'idea_prioritization' => [
        'name' => 'Priorisation des idées',
        'columns' => [
            ['title' => 'Priorité basse', 'description' => 'À faire un jour, rien ne casse si ça attend'],
            ['title' => 'Priorité moyenne', 'description' => 'À faire dans le prochain cycle ou le suivant'],
            ['title' => 'Priorité haute', 'description' => 'Coûte à l’équipe ou aux clients dès maintenant — à traiter en premier'],
        ],
    ],
    'harry_potter' => [
        'name' => 'Harry Potter',
        'columns' => [
            ['title' => 'Felix Felicis', 'description' => 'Les bonnes choses !'],
            ['title' => 'Élixir de Baruffio', 'description' => 'Ce que nous avons appris !'],
            ['title' => 'Petrificus Totalus', 'description' => 'Qu’est-ce qui nous a ralentis ?'],
            ['title' => 'Coupe des Trois Sorciers', 'description' => 'Les remerciements !'],
            ['title' => 'Actions', 'description' => 'Ce qu’il faut prendre en compte'],
        ],
    ],
    'kalm' => [
        'name' => 'KALM (Garder, Ajouter, Plus, Moins)',
        'columns' => [
            ['title' => 'Garder', 'description' => 'Fonctionne aujourd’hui et serait la première chose perdue sous pression'],
            ['title' => 'Ajouter', 'description' => 'Quelque chose que nous n’avons pas encore et voulons essayer'],
            ['title' => 'Plus', 'description' => 'Arrive déjà parfois et devrait devenir une habitude'],
            ['title' => 'Moins', 'description' => 'Utile à petite dose — à réduire plutôt qu’à supprimer'],
        ],
    ],
    'marie_kondo' => [
        'name' => 'Méthode Marie Kondo',
        'columns' => [
            ['title' => 'Source de joie', 'description' => 'Ce qui s’est bien passé et que l’on garde volontiers'],
            ['title' => 'À jeter', 'description' => 'Ce qui a mal tourné et que l’on ne veut pas garder'],
            ['title' => 'À recycler', 'description' => 'Ce que tu veux améliorer et réutiliser'],
        ],
    ],
    'game_of_thrones' => [
        'name' => 'Game of Thrones',
        'columns' => [
            ['title' => 'Le château', 'description' => 'En quoi sommes-nous excellents ?'],
            ['title' => 'Le trou', 'description' => 'Quels sont les problèmes actuels ?'],
            ['title' => 'Le Mur', 'description' => 'Qu’est-ce qui ferait de nous une meilleure équipe ?'],
            ['title' => 'Les Marcheurs blancs', 'description' => 'Quels sont les risques et défis possibles ?'],
        ],
    ],
    'love_want_hate_learn' => [
        'name' => 'J’aime, Je veux, Je déteste, J’ai appris',
        'columns' => [
            ['title' => 'J’aime…', 'description' => 'Ce que tu apprécies vraiment dans notre façon de travailler'],
            ['title' => 'Je veux…', 'description' => 'Les changements que tu souhaites, formulés comme ton propre souhait'],
            ['title' => 'Je déteste…', 'description' => 'Ce qui te frustre — la version honnête, sans filtre'],
            ['title' => 'Maintenant, je sais que…', 'description' => 'Les découvertes du sprint que toute l’équipe devrait partager'],
        ],
    ],
    'kudos' => [
        'name' => 'Kudos',
        'columns' => [
            ['title' => 'Kudos', 'description' => 'Remercie une personne précise pour quelque chose de précis'],
            ['title' => 'Ce qui s’est bien passé', 'description' => 'Ce qui a fonctionné et doit être protégé au prochain sprint'],
            ['title' => 'À améliorer', 'description' => 'Là où l’équipe a perdu du temps ou de la qualité'],
            ['title' => 'Actions', 'description' => 'Des étapes avec un responsable, tirées de la colonne précédente'],
        ],
    ],
    'pros_and_cons' => [
        'name' => 'Pour et contre',
        'columns' => [
            ['title' => 'Pour', 'description' => 'Les arguments en faveur de l’option — des bénéfices, pas des espoirs'],
            ['title' => 'Contre', 'description' => 'Les coûts, les risques et ce à quoi l’option engage l’équipe'],
        ],
    ],
    'sprint_diagnostics' => [
        'name' => 'Diagnostic du sprint',
        'columns' => [
            ['title' => 'Comment était ce sprint ? Note de 1 à 10 (communication, collaboration, qualité, pression)', 'description' => 'Une note et une phrase sur ce qui l’explique'],
            ['title' => 'Grand coup de cœur ou grosse déception', 'description' => 'Le moment le plus fort du sprint, positif ou négatif'],
            ['title' => 'Que pourrions-nous faire encore mieux ou autrement ? Comment ?', 'description' => 'Des améliorations formulées comme un changement, pas une plainte'],
            ['title' => 'Actions', 'description' => 'Un responsable et une date pour chaque changement décidé'],
        ],
    ],
    'three_ls' => [
        'name' => 'Les 3 A (Aimé, Appris, Manqué)',
        'columns' => [
            ['title' => 'Aimé', 'description' => 'Ce que tu as apprécié pendant le sprint'],
            ['title' => 'Appris', 'description' => 'Des connaissances nouvelles — sur le produit, le système ou l’équipe'],
            ['title' => 'Manqué', 'description' => 'Ce qui manquait : information, temps, accès ou décision'],
        ],
    ],
    'daki' => [
        'name' => 'DAKI (Abandonner, Ajouter, Garder, Améliorer)',
        'columns' => [
            ['title' => 'Abandonner', 'description' => 'Plus aucune valeur — un rapport que personne ne lit, une étape déjà automatisée'],
            ['title' => 'Ajouter', 'description' => 'Une nouvelle pratique à essayer, une ou deux par sprint'],
            ['title' => 'Garder', 'description' => 'Fonctionne aujourd’hui et doit être défendu sous pression'],
            ['title' => 'Améliorer', 'description' => 'Presque bien — à corriger plutôt qu’à supprimer'],
        ],
    ],
    'swot' => [
        'name' => 'Analyse SWOT',
        'columns' => [
            ['title' => 'Forces', 'description' => 'Les atouts internes sur lesquels l’équipe peut compter'],
            ['title' => 'Faiblesses', 'description' => 'Les lacunes internes qui coûtent du temps ou de la qualité'],
            ['title' => 'Opportunités', 'description' => 'Les ouvertures externes à saisir tant qu’elles existent'],
            ['title' => 'Menaces', 'description' => 'Les risques externes qui feraient mal si rien ne change'],
        ],
    ],
    'good_bad_ugly' => [
        'name' => 'Le Bon, la Brute et le Truand',
        'columns' => [
            ['title' => 'Le bon', 'description' => 'Ce qui s’est bien passé ou a bien fonctionné'],
            ['title' => 'La brute', 'description' => 'Ce qui ne s’est pas passé comme prévu, ou les problèmes apparus'],
            ['title' => 'Le truand', 'description' => 'Ce que l’équipe ne pouvait pas changer mais doit pouvoir signaler'],
        ],
    ],
    'kanban' => [
        'name' => 'Kanban',
        'columns' => [
            ['title' => 'À faire', 'description' => 'Le travail convenu pas encore commencé'],
            ['title' => 'En cours', 'description' => 'En cours en ce moment, avec un nom associé'],
            ['title' => 'Terminé', 'description' => 'Fini et vérifié — la preuve que l’équipe avance'],
        ],
    ],
    'six_thinking_hats' => [
        'name' => 'Les six chapeaux de la réflexion',
        'columns' => [
            ['title' => 'Chapeau vert', 'description' => 'Créativité : alternatives et idées, sans jugement pour l’instant'],
            ['title' => 'Chapeau bleu', 'description' => 'Processus : à quoi sert cette discussion et ce qui en est exclu'],
            ['title' => 'Chapeau blanc', 'description' => 'Faits : chiffres et observations, sans interprétation'],
            ['title' => 'Chapeau rouge', 'description' => 'Émotions : réactions instinctives, sans justification'],
            ['title' => 'Chapeau noir', 'description' => 'Prudence : les risques et ce qui pourrait mal tourner'],
            ['title' => 'Chapeau jaune', 'description' => 'Bénéfices : la valeur et ce qui fonctionne déjà'],
        ],
    ],
    'post_mortem' => [
        'name' => 'Post-mortem',
        'columns' => [
            ['title' => 'Ce que nous avons aimé', 'description' => 'Ce qui a tenu sous pression et doit rester'],
            ['title' => 'Ce qui nous a manqué', 'description' => 'Les lacunes révélées par l’incident : alertes, docs, accès'],
            ['title' => 'Ce que j’ai appris', 'description' => 'Ce que chacun sait maintenant et ne savait pas avant'],
            ['title' => 'Pour la prochaine fois', 'description' => 'Des suites avec un responsable pour détecter plus tôt la même panne'],
            ['title' => 'Remerciements', 'description' => 'La reconnaissance pour celles et ceux qui ont porté l’incident'],
        ],
    ],
    'rose_bud_thorn' => [
        'name' => 'Rose, Bourgeon, Épine',
        'columns' => [
            ['title' => 'Rose', 'description' => 'Ce qui fonctionne clairement en ce moment'],
            ['title' => 'Bourgeon', 'description' => 'Des signes prometteurs à soutenir avant qu’ils ne s’estompent'],
            ['title' => 'Épine', 'description' => 'Ce qui fait mal et continuera tant que personne ne le corrige'],
        ],
    ],
    'hopes_and_fears' => [
        'name' => 'Espoirs et craintes',
        'columns' => [
            ['title' => 'Espoirs', 'description' => 'Ce que l’équipe veut que ce projet ou ce cycle devienne'],
            ['title' => 'Craintes', 'description' => 'Ce qui pourrait mal tourner — dit à voix haute tant que ça coûte peu'],
        ],
    ],
    'good_bad_better_best' => [
        'name' => 'Bien, Mal, Mieux, Le meilleur',
        'columns' => [
            ['title' => 'Bien', 'description' => 'Ce qui s’est bien passé'],
            ['title' => 'Mal', 'description' => 'Ce qui s’est mal passé'],
            ['title' => 'Mieux', 'description' => 'Les pistes d’amélioration'],
            ['title' => 'Le meilleur', 'description' => 'Résultats, performances, actions et personnes remarquables'],
        ],
    ],
    'likes_wishes_wonders' => [
        'name' => 'J’aime, Je souhaite, Je me demande',
        'columns' => [
            ['title' => 'J’aime', 'description' => 'Ce que tu apprécies dans notre façon de travailler aujourd’hui'],
            ['title' => 'Je souhaite', 'description' => 'Les changements voulus, formulés comme un souhait plutôt qu’une exigence'],
            ['title' => 'Je me demande', 'description' => 'Les questions et doutes auxquels personne n’a répondu'],
        ],
    ],
    'okr' => [
        'name' => 'OKR (Objectifs et résultats clés)',
        'columns' => [
            ['title' => 'Résultats clés', 'description' => 'Des résultats mesurables qui prouvent que l’objectif est atteint'],
            ['title' => 'Initiatives', 'description' => 'Le travail que l’équipe fera réellement pour faire bouger ces chiffres'],
            ['title' => 'Objectifs', 'description' => 'Où l’équipe veut aller — qualitatif et ambitieux'],
        ],
    ],
    'www' => [
        'name' => 'WWW (A bien marché, A à moitié marché, N’a pas marché)',
        'columns' => [
            ['title' => 'A bien marché', 'description' => 'Des réussites nettes à conserver délibérément'],
            ['title' => 'A à moitié marché', 'description' => 'Des demi-réussites : la bonne idée, une exécution ratée'],
            ['title' => 'N’a pas marché', 'description' => 'Ce qui a échoué et ne doit pas être refait tel quel'],
        ],
    ],
    'safety_check' => [
        'name' => 'Vérification de sécurité',
        'columns' => [
            ['title' => '5', 'description' => 'Aucun problème — je dirai tout, même ce qui dérange'],
            ['title' => '4', 'description' => 'Plutôt à l’aise — j’adoucirais la formulation d’un ou deux sujets'],
            ['title' => '3', 'description' => 'Sélectif — je parlerai du processus, pas des personnes ni de mes erreurs'],
            ['title' => '2', 'description' => 'Sur la réserve — j’approuverai les autres sans rien soulever moi-même'],
            ['title' => '1', 'description' => 'Silencieux — je ne dirai rien d’important pendant cette séance'],
        ],
    ],
    'fishbone' => [
        'name' => 'Diagramme d’Ishikawa',
        'columns' => [
            ['title' => 'Personnes', 'description' => 'Causes liées aux compétences, aux effectifs ou au savoir d’une seule personne'],
            ['title' => 'Processus', 'description' => 'Causes dans notre façon de travailler : étapes sautées, règles non écrites'],
            ['title' => 'Outils', 'description' => 'Causes dans l’outillage : alertes, tests, environnements manquants'],
            ['title' => 'Programme', 'description' => 'Causes dans la planification : périmètre, budget, échéances'],
            ['title' => 'Environnement', 'description' => 'Causes extérieures à l’équipe : fournisseurs, trafic, réorganisations'],
            ['title' => 'Solutions', 'description' => 'Des correctifs qui traitent les causes ci-dessus, avec un responsable'],
        ],
    ],
    'wrap' => [
        'name' => 'WRAP (Souhaits, Risques, Remerciements, Énigmes)',
        'columns' => [
            ['title' => 'Quels sont tes souhaits ?', 'description' => 'Ce que tu veux pour l’équipe à l’avenir'],
            ['title' => 'Qu’apprécies-tu ?', 'description' => 'La reconnaissance pour celles et ceux qui t’ont facilité le travail'],
            ['title' => 'Quels risques vois-tu ?', 'description' => 'Des risques visibles dont personne ne s’occupe encore'],
            ['title' => 'Qu’est-ce qui t’intrigue ?', 'description' => 'Ce qui ne colle pas et mérite un examen plus attentif'],
        ],
    ],
    'learning_matrix' => [
        'name' => 'Matrice d’apprentissage',
        'columns' => [
            ['title' => ':)', 'description' => 'Ce qui s’est bien passé et mérite d’être répété'],
            ['title' => ':(', 'description' => 'Ce qui s’est mal passé et a coûté à l’équipe'],
            ['title' => 'Idée !', 'description' => 'Des propositions pour le prochain sprint'],
            ['title' => 'Remerciements', 'description' => 'Des remerciements adressés à des personnes précises'],
        ],
    ],
    'raid' => [
        'name' => 'Registre RAID (Risques, Hypothèses, Problèmes, Dépendances)',
        'columns' => [
            ['title' => 'Risques', 'description' => 'Ce qui pourrait mal tourner plus tard — pas encore réel'],
            ['title' => 'Hypothèses', 'description' => 'Ce que le plan tient pour acquis sans que personne l’ait vérifié'],
            ['title' => 'Problèmes', 'description' => 'Des problèmes déjà présents qui ont besoin d’un responsable'],
            ['title' => 'Dépendances', 'description' => 'Le travail ou les décisions extérieurs que l’équipe attend'],
        ],
    ],
    'liked_lacked_change' => [
        'name' => 'Aimé, Manqué, Changer',
        'columns' => [
            ['title' => 'Aimé', 'description' => 'Qu’est-ce qui nous a aidés à avancer ?'],
            ['title' => 'Manqué', 'description' => 'Qu’est-ce qui nous a freinés ?'],
            ['title' => 'Que puis-je changer ?', 'description' => 'Que devrais-je faire autrement ?'],
            ['title' => 'Que pouvons-nous changer ?', 'description' => 'Que devrions-nous faire autrement en équipe ?'],
        ],
    ],
    'time_added_stolen_restored' => [
        'name' => 'Temps : gagné, volé, récupéré',
        'columns' => [
            ['title' => 'Quels projets ou choix te font gagner du temps dans la journée ?', 'description' => 'Les habitudes et choix qui te rendent des heures'],
            ['title' => 'Quels choix personnels te volent du temps ?', 'description' => 'Là où ton temps fuit : interruptions, réunions, reprises'],
            ['title' => 'Comment récupères-tu ou récupérerais-tu le temps perdu ?', 'description' => 'Des moyens concrets de récupérer les heures listées plus haut'],
        ],
    ],
    'appreciation' => [
        'name' => 'Rétro de reconnaissance',
        'columns' => [
            ['title' => 'Je suis content que…', 'description' => 'Ce qui t’a fait plaisir pendant ce sprint, même petit'],
            ['title' => 'Je me demande…', 'description' => 'Les questions et doutes que tu emportes au prochain sprint'],
            ['title' => 'Ce n’était pas génial que…', 'description' => 'Ce qui t’a déçu — le problème, pas la personne'],
            ['title' => 'Actions', 'description' => 'Des suites avec un responsable et une date'],
            ['title' => 'Je remercie…', 'description' => 'Des remerciements pour une aide précise de personnes précises'],
        ],
    ],
    'christmas' => [
        'name' => 'Rétro de Noël',
        'columns' => [
            ['title' => 'Noël passé', 'description' => 'Ce qui, selon toi, aurait pu se passer autrement'],
            ['title' => 'Noël présent', 'description' => 'Ce qui fonctionne très bien, et tes remerciements aux collègues'],
            ['title' => 'Noël futur', 'description' => 'Ce que tu veux avoir à l’avenir'],
            ['title' => 'Gourmandises de Noël', 'description' => 'Partage ton plat de Noël préféré'],
        ],
    ],
    'good_bad_learned_learning' => [
        'name' => 'Bien, Mal, Appris, À apprendre',
        'columns' => [
            ['title' => 'Qu’est-ce qui s’est bien passé ?', 'description' => 'Les réussites à répéter volontairement'],
            ['title' => 'Qu’est-ce qui ne s’est pas si bien passé ?', 'description' => 'Ce qui a mal tourné ou a coûté du temps à l’équipe'],
            ['title' => 'Que voulais-je apprendre pendant ce sprint, et l’ai-je fait ?', 'description' => 'Tes objectifs d’apprentissage du sprint et comment ils se sont passés'],
            ['title' => 'Que veux-je apprendre au prochain sprint ?', 'description' => 'Ce que tu veux apprendre ensuite et ce dont tu as besoin pour cela'],
        ],
    ],
    'halloween' => [
        'name' => 'Halloween : le sprint qui fait peur',
        'columns' => [
            ['title' => 'Friandises d’Halloween !', 'description' => 'Planter le décor'],
            ['title' => 'Histoires de fantômes !', 'description' => 'Recueillir les faits'],
            ['title' => 'Un bonbon ou un sort !', 'description' => 'Tirer des enseignements'],
            ['title' => 'Choisis une porte !', 'description' => 'Décider quoi faire'],
            ['title' => 'La frayeur du sprint !', 'description' => 'Clôturer la rétrospective'],
        ],
    ],
    'plus_delta' => [
        'name' => 'Plus / Delta',
        'columns' => [
            ['title' => 'Plus', 'description' => 'Tout ce qui se passe bien et doit être répété'],
            ['title' => 'Delta', 'description' => 'Tout ce que tu veux changer ou qui peut être amélioré'],
        ],
    ],
    'energy_levels' => [
        'name' => 'Niveaux d’énergie',
        'columns' => [
            ['title' => 'Pleine charge', 'description' => 'Ce qui t’a donné de l’énergie et t’a fait avancer'],
            ['title' => 'Charge moyenne', 'description' => 'Stable mais sans relief — le sprint ne t’a ni porté ni épuisé'],
            ['title' => 'Batterie faible', 'description' => 'Ce qui t’a épuisé ou a sapé ta motivation'],
            ['title' => 'Énergie du sprint', 'description' => 'Comment l’énergie de l’équipe a évolué sur l’ensemble du sprint'],
        ],
    ],
    'weather_forecast' => [
        'name' => 'Bulletin météo',
        'columns' => [
            ['title' => 'Orageux', 'description' => 'Qu’est-ce qui a été tempétueux ? Quels problèmes as-tu rencontrés, et qu’est-ce qui a empêché l’équipe d’avancer ?'],
            ['title' => 'Pluvieux', 'description' => 'Qu’est-ce qui a été pénible ? Quelles difficultés as-tu rencontrées, et comment les as-tu surmontées ?'],
            ['title' => 'Nuageux', 'description' => 'Qu’est-ce qui a été agréable ? Quelles expériences positives as-tu vécues, et tes collègues t’ont-ils soutenu ?'],
            ['title' => 'Ensoleillé', 'description' => 'Qu’est-ce qui a été lumineux ? Les objectifs du sprint sont-ils atteints, et es-tu satisfait de ta contribution ?'],
        ],
    ],
    'esvp' => [
        'name' => 'ESVP (Explorateurs, Acheteurs, Vacanciers, Prisonniers)',
        'columns' => [
            ['title' => 'Explorateurs', 'description' => 'Veulent découvrir de nouvelles idées et de nouvelles pistes'],
            ['title' => 'Acheteurs', 'description' => 'Regardent ce qui est proposé et veulent repartir avec au moins une idée utile'],
            ['title' => 'Vacanciers', 'description' => 'Ne s’intéressent pas aux rétrospectives, mais apprécient une pause dans le quotidien'],
            ['title' => 'Prisonniers', 'description' => 'Se sentent obligés d’être là et préféreraient faire autre chose'],
        ],
    ],
    'soar' => [
        'name' => 'Analyse SOAR',
        'columns' => [
            ['title' => 'Forces', 'description' => 'En quoi excellons-nous ?'],
            ['title' => 'Opportunités', 'description' => 'Quelles niches et opportunités pouvons-nous exploiter ?'],
            ['title' => 'Aspirations', 'description' => 'Que voulons-nous accomplir ?'],
            ['title' => 'Résultats', 'description' => 'Comment mesurerons-nous que les objectifs et aspirations sont atteints ?'],
        ],
    ],
    'pre_mortem' => [
        'name' => 'Pré-mortem',
        'columns' => [
            ['title' => '(Hypothèse) Le projet a échoué ! Qu’est-ce qui a mal tourné ?', 'description' => 'Imagine que le projet a déjà échoué — décris comment c’est arrivé'],
            ['title' => 'Qu’est-ce que nous n’avons pas fait ?', 'description' => 'Les étapes sautées par l’équipe sur le chemin de cet échec'],
            ['title' => 'Quels problèmes actuels subsistent ?', 'description' => 'Les problèmes qui existent aujourd’hui et aggraveraient l’échec'],
            ['title' => 'D’autres inquiétudes ?', 'description' => 'Tout ce qui te tracasse encore et n’a pas de responsable'],
        ],
    ],
    'custom' => [
        'name' => 'Personnalisé',
        'columns' => [],
    ],
];
