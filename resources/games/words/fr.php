<?php

$drawable = [
    'ordinateur portable', 'clavier', 'souris', 'écran', 'imprimante', 'tasse de café', 'pizza', 'sandwich', 'biscuit', 'banane',
    'pomme', 'fusée', 'robot', 'araignée', 'tableau blanc', 'post-it', 'feutre', 'crayon', 'ciseaux', 'agrafeuse',
    'trombone', 'calendrier', 'horloge', 'réveil', 'sablier', 'chronomètre', 'trophée', 'médaille', 'couronne', 'ampoule',
    'pile', 'prise', 'casque audio', 'micro', 'appareil photo', 'smartphone', 'satellite', 'antenne', 'serveur', 'nuage',
    'parapluie', 'arc-en-ciel', 'soleil', 'lune', 'étoile', 'planète', 'volcan', 'montagne', 'île', 'pont',
    'phare', 'château', 'maison', 'bureau', 'chaise', 'canapé', 'lampe', 'fenêtre', 'porte', 'clé',
    'cadenas', 'portefeuille', 'pièce', 'tirelire', 'sac à dos', 'valise', 'mallette', 'enveloppe', 'boîte aux lettres', 'journal',
    'livre', 'carnet', 'carte', 'boussole', 'ancre', 'voilier', 'sous-marin', 'train', 'vélo', 'trottinette',
    'voiture', 'bus', 'camion', 'tracteur', 'hélicoptère', 'avion', 'parachute', 'ballon', 'cerf-volant', 'échelle',
    'marteau', 'clé anglaise', 'tournevis', 'scie', 'pelle', 'seau', 'balai', 'brosse à dents', 'lunettes', 'chapeau',
    'cravate', 'chemise', 'chaussette', 'botte', 'gant', 'écharpe', 'bague', 'guitare', 'piano', 'tambour',
    'trompette', 'violon', 'ballon de foot', 'ballon de basket', 'skateboard', 'dés', 'puzzle', 'ours en peluche', 'bonhomme de neige', 'cactus',
    'fleur', 'arbre', 'feuille', 'champignon', 'carotte', 'ananas', 'cerise', 'citron', 'gâteau', 'beignet',
    'glace', 'pop-corn', 'hamburger', 'taco', 'sushi', 'fromage', 'pain', 'poisson', 'baleine', 'pieuvre',
    'tortue', 'pingouin', 'hibou', 'éléphant', 'girafe', 'lion', 'singe', 'escargot', 'papillon', 'abeille',
    'dragon', 'fantôme', 'licorne', 'lampe torche', 'bougie', 'feu de camp', 'aimant', 'microscope', 'télescope', 'thermomètre',
    'bouclier', 'drapeau', 'tente', 'clôture', 'feu rouge', 'fontaine', 'moulin à vent', 'igloo', 'pyramide', 'serpent',
    'grenouille', 'lapin', 'cheval', 'canard', 'cochon', 'vache', 'insecte', 'vaisseau spatial', 'cloche', 'coccinelle',
];

$abstract = [
    'sprint', 'backlog', 'rétrospective', 'échéance', 'déploiement', 'mêlée quotidienne', 'vélocité', 'estimation', 'retour', 'refactorisation',
    'demande de fusion', 'revue de code', 'conflit de fusion', 'livraison', 'feuille de route', 'jalon', 'partie prenante', 'responsable produit', 'scrum master', 'récit utilisateur',
    'épopée', 'définition de fini', 'burndown', 'kanban', 'flux de travail', 'priorité', 'blocage', 'dépendance', 'dette technique', 'correctif',
    'retour arrière', 'base de données', 'algorithme', 'variable', 'fonction', 'framework', 'bibliothèque', 'compilateur', 'débogueur', 'syntaxe',
    'exception', 'délai dépassé', 'latence', 'bande passante', 'mot de passe', 'pare-feu', 'chiffrement', 'sauvegarde', 'version', 'branche',
    'commit', 'dépôt', 'pipeline', 'conteneur', 'migration', 'prototype', 'maquette', 'utilisabilité', 'accessibilité', 'intégration',
    'réunion', 'ordre du jour', 'remue-méninges', 'atelier', 'présentation', 'budget', 'facture', 'stratégie', 'vision', 'innovation',
    'collaboration', 'confiance', 'empathie', 'motivation', 'concentration', 'patience', 'curiosité', 'courage', "esprit d'équipe", 'consensus',
    'compromis', 'décision', 'expérience', 'hypothèse', 'indicateur', 'idée', 'itération', 'incrément', 'périmètre', 'qualité',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
