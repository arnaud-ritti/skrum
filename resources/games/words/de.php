<?php

$themes = [
    'work' => [
        'drawable' => [
            'Laptop', 'Tastatur', 'Maus', 'Bildschirm', 'Drucker', 'Kaffeetasse', 'Rakete', 'Roboter', 'Whiteboard', 'Haftnotiz',
            'Textmarker', 'Bleistift', 'Schere', 'Hefter', 'Büroklammer', 'Kalender', 'Uhr', 'Wecker', 'Sanduhr', 'Stoppuhr',
            'Pokal', 'Medaille', 'Glühbirne', 'Batterie', 'Stecker', 'Kopfhörer', 'Mikrofon', 'Kamera', 'Smartphone', 'Satellit',
            'Antenne', 'Server', 'Schreibtisch', 'Stuhl', 'Lampe', 'Aktentasche', 'Briefumschlag', 'Notizbuch', 'Magnet', 'Mikroskop',
            'Teleskop', 'Thermometer', 'Raumschiff',
        ],
        'abstract' => [
            'Sprint', 'Backlog', 'Retrospektive', 'Frist', 'Deployment', 'Daily', 'Geschwindigkeit', 'Schätzung', 'Feedback', 'Refactoring',
            'Pull-Request', 'Code-Review', 'Merge-Konflikt', 'Release', 'Roadmap', 'Meilenstein', 'Stakeholder', 'Product Owner', 'Scrum Master', 'User Story',
            'Epic', 'Definition of Done', 'Burndown', 'Kanban', 'Arbeitsablauf', 'Priorität', 'Blocker', 'Abhängigkeit', 'technische Schulden', 'Hotfix',
            'Rollback', 'Datenbank', 'Algorithmus', 'Variable', 'Funktion', 'Framework', 'Bibliothek', 'Compiler', 'Debugger', 'Syntax',
            'Ausnahme', 'Zeitüberschreitung', 'Latenz', 'Bandbreite', 'Passwort', 'Firewall', 'Verschlüsselung', 'Backup', 'Version', 'Branch',
            'Commit', 'Repository', 'Pipeline', 'Container', 'Migration', 'Prototyp', 'Wireframe', 'Benutzbarkeit', 'Barrierefreiheit', 'Einarbeitung',
            'Besprechung', 'Tagesordnung', 'Brainstorming', 'Workshop', 'Präsentation', 'Budget', 'Rechnung', 'Strategie', 'Vision', 'Innovation',
            'Zusammenarbeit', 'Vertrauen', 'Empathie', 'Motivation', 'Konzentration', 'Geduld', 'Neugier', 'Mut', 'Teamgeist', 'Konsens',
            'Kompromiss', 'Entscheidung', 'Experiment', 'Hypothese', 'Kennzahl', 'Erkenntnis', 'Iteration', 'Inkrement', 'Umfang', 'Qualität',
        ],
    ],
    'food' => [
        'drawable' => [
            'Pizza', 'Sandwich', 'Keks', 'Banane', 'Apfel', 'Karotte', 'Ananas', 'Kirsche', 'Zitrone', 'Kuchen',
            'Donut', 'Eistüte', 'Popcorn', 'Burger', 'Taco', 'Sushi', 'Käse', 'Brot',
        ],
    ],
    'nature' => [
        'drawable' => [
            'Spinne', 'Wolke', 'Regenbogen', 'Sonne', 'Mond', 'Stern', 'Planet', 'Vulkan', 'Berg', 'Insel',
            'Kaktus', 'Blume', 'Baum', 'Blatt', 'Pilz', 'Fisch', 'Wal', 'Krake', 'Schildkröte', 'Pinguin',
            'Eule', 'Elefant', 'Giraffe', 'Löwe', 'Affe', 'Schnecke', 'Schmetterling', 'Biene', 'Schlange', 'Frosch',
            'Hase', 'Pferd', 'Ente', 'Schwein', 'Kuh', 'Käfer', 'Marienkäfer',
        ],
    ],
    'objects' => [
        'drawable' => [
            'Krone', 'Regenschirm', 'Brücke', 'Leuchtturm', 'Burg', 'Haus', 'Sofa', 'Fenster', 'Tür', 'Schlüssel',
            'Vorhängeschloss', 'Geldbörse', 'Münze', 'Sparschwein', 'Rucksack', 'Koffer', 'Briefkasten', 'Zeitung', 'Buch', 'Landkarte',
            'Kompass', 'Anker', 'Segelboot', 'U-Boot', 'Zug', 'Fahrrad', 'Roller', 'Auto', 'Bus', 'Lastwagen',
            'Traktor', 'Hubschrauber', 'Flugzeug', 'Fallschirm', 'Luftballon', 'Flugdrachen', 'Leiter', 'Hammer', 'Schraubenschlüssel', 'Schraubenzieher',
            'Säge', 'Schaufel', 'Eimer', 'Besen', 'Zahnbürste', 'Brille', 'Hut', 'Krawatte', 'Hemd', 'Socke',
            'Stiefel', 'Handschuh', 'Schal', 'Ring', 'Gitarre', 'Klavier', 'Trommel', 'Trompete', 'Geige', 'Tennisschläger',
            'Basketball', 'Skateboard', 'Würfel', 'Puzzle', 'Teddybär', 'Schneemann', 'Drache', 'Gespenst', 'Einhorn', 'Taschenlampe',
            'Kerze', 'Lagerfeuer', 'Schild', 'Flagge', 'Zelt', 'Zaun', 'Ampel', 'Brunnen', 'Windmühle', 'Iglu',
            'Pyramide', 'Glocke',
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
