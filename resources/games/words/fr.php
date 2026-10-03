<?php

$themes = [
    'work' => [
        'drawable' => [
            'ordinateur portable', 'clavier', 'souris', 'écran', 'imprimante', 'tasse de café', 'fusée', 'robot', 'tableau blanc', 'post-it',
            'feutre', 'crayon', 'ciseaux', 'agrafeuse', 'trombone', 'calendrier', 'horloge', 'réveil', 'sablier', 'chronomètre',
            'trophée', 'médaille', 'ampoule', 'pile', 'prise', 'casque audio', 'micro', 'appareil photo', 'smartphone', 'satellite',
            'antenne', 'serveur', 'bureau', 'chaise', 'lampe', 'mallette', 'enveloppe', 'carnet', 'aimant', 'microscope',
            'télescope', 'thermomètre', 'vaisseau spatial',
        ],
        'abstract' => [
            'sprint', 'backlog', 'rétrospective', 'échéance', 'déploiement', 'mêlée quotidienne', 'vélocité', 'estimation', 'retour', 'refactorisation',
            'demande de fusion', 'revue de code', 'conflit de fusion', 'livraison', 'feuille de route', 'jalon', 'partie prenante', 'responsable produit', 'scrum master', 'récit utilisateur',
            'épopée', 'définition de fini', 'burndown', 'kanban', 'flux de travail', 'priorité', 'blocage', 'dépendance', 'dette technique', 'correctif',
            'retour arrière', 'base de données', 'algorithme', 'variable', 'fonction', 'framework', 'bibliothèque', 'compilateur', 'débogueur', 'syntaxe',
            'exception', 'délai dépassé', 'latence', 'bande passante', 'mot de passe', 'pare-feu', 'chiffrement', 'sauvegarde', 'version', 'branche',
            'commit', 'dépôt', 'pipeline', 'conteneur', 'migration', 'prototype', 'maquette', 'utilisabilité', 'accessibilité', 'intégration',
            'réunion', 'ordre du jour', 'remue-méninges', 'atelier', 'présentation', 'budget', 'facture', 'stratégie', 'vision', 'innovation',
            'collaboration', 'confiance', 'empathie', 'motivation', 'concentration', 'patience', 'curiosité', 'courage', 'esprit d\'équipe', 'consensus',
            'compromis', 'décision', 'expérience', 'hypothèse', 'indicateur', 'idée', 'itération', 'incrément', 'périmètre', 'qualité',
        ],
    ],
    'food' => [
        'drawable' => [
            'pizza', 'sandwich', 'biscuit', 'banane', 'pomme', 'carotte', 'ananas', 'cerise', 'citron', 'gâteau',
            'beignet', 'glace', 'pop-corn', 'hamburger', 'taco', 'sushi', 'fromage', 'pain',
        ],
    ],
    'nature' => [
        'drawable' => [
            'araignée', 'nuage', 'arc-en-ciel', 'soleil', 'lune', 'étoile', 'planète', 'volcan', 'montagne', 'île',
            'cactus', 'fleur', 'arbre', 'feuille', 'champignon', 'poisson', 'baleine', 'pieuvre', 'tortue', 'pingouin',
            'hibou', 'éléphant', 'girafe', 'lion', 'singe', 'escargot', 'papillon', 'abeille', 'serpent', 'grenouille',
            'lapin', 'cheval', 'canard', 'cochon', 'vache', 'insecte', 'coccinelle',
        ],
    ],
    'objects' => [
        'drawable' => [
            'couronne', 'parapluie', 'pont', 'phare', 'château', 'maison', 'canapé', 'fenêtre', 'porte', 'clé',
            'cadenas', 'portefeuille', 'pièce', 'tirelire', 'sac à dos', 'valise', 'boîte aux lettres', 'journal', 'livre', 'carte',
            'boussole', 'ancre', 'voilier', 'sous-marin', 'train', 'vélo', 'trottinette', 'voiture', 'bus', 'camion',
            'tracteur', 'hélicoptère', 'avion', 'parachute', 'ballon', 'cerf-volant', 'échelle', 'marteau', 'clé anglaise', 'tournevis',
            'scie', 'pelle', 'seau', 'balai', 'brosse à dents', 'lunettes', 'chapeau', 'cravate', 'chemise', 'chaussette',
            'botte', 'gant', 'écharpe', 'bague', 'guitare', 'piano', 'tambour', 'trompette', 'violon', 'ballon de foot',
            'ballon de basket', 'skateboard', 'dés', 'puzzle', 'ours en peluche', 'bonhomme de neige', 'dragon', 'fantôme', 'licorne', 'lampe torche',
            'bougie', 'feu de camp', 'bouclier', 'drapeau', 'tente', 'clôture', 'feu rouge', 'fontaine', 'moulin à vent', 'igloo',
            'pyramide', 'cloche',
        ],
    ],
];

$entries = [];

foreach ($themes as $theme => $lists) {
    foreach ($lists['drawable'] ?? [] as $word) {
        $entries[] = ['word' => $word, 'drawable' => true, 'theme' => $theme];
    }

    foreach ($lists['abstract'] ?? [] as $word) {
        $entries[] = ['word' => $word, 'drawable' => false, 'theme' => $theme];
    }
}

return $entries;
