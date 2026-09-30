<?php

$drawable = [
    'Laptop', 'Tastatur', 'Maus', 'Bildschirm', 'Drucker', 'Kaffeetasse', 'Pizza', 'Sandwich', 'Keks', 'Banane',
    'Apfel', 'Rakete', 'Roboter', 'Spinne', 'Whiteboard', 'Haftnotiz', 'Textmarker', 'Bleistift', 'Schere', 'Hefter',
    'Büroklammer', 'Kalender', 'Uhr', 'Wecker', 'Sanduhr', 'Stoppuhr', 'Pokal', 'Medaille', 'Krone', 'Glühbirne',
    'Batterie', 'Stecker', 'Kopfhörer', 'Mikrofon', 'Kamera', 'Smartphone', 'Satellit', 'Antenne', 'Server', 'Wolke',
    'Regenschirm', 'Regenbogen', 'Sonne', 'Mond', 'Stern', 'Planet', 'Vulkan', 'Berg', 'Insel', 'Brücke',
    'Leuchtturm', 'Burg', 'Haus', 'Schreibtisch', 'Stuhl', 'Sofa', 'Lampe', 'Fenster', 'Tür', 'Schlüssel',
    'Vorhängeschloss', 'Geldbörse', 'Münze', 'Sparschwein', 'Rucksack', 'Koffer', 'Aktentasche', 'Briefumschlag', 'Briefkasten', 'Zeitung',
    'Buch', 'Notizbuch', 'Landkarte', 'Kompass', 'Anker', 'Segelboot', 'U-Boot', 'Zug', 'Fahrrad', 'Roller',
    'Auto', 'Bus', 'Lastwagen', 'Traktor', 'Hubschrauber', 'Flugzeug', 'Fallschirm', 'Luftballon', 'Flugdrachen', 'Leiter',
    'Hammer', 'Schraubenschlüssel', 'Schraubenzieher', 'Säge', 'Schaufel', 'Eimer', 'Besen', 'Zahnbürste', 'Brille', 'Hut',
    'Krawatte', 'Hemd', 'Socke', 'Stiefel', 'Handschuh', 'Schal', 'Ring', 'Gitarre', 'Klavier', 'Trommel',
    'Trompete', 'Geige', 'Tennisschläger', 'Basketball', 'Skateboard', 'Würfel', 'Puzzle', 'Teddybär', 'Schneemann', 'Kaktus',
    'Blume', 'Baum', 'Blatt', 'Pilz', 'Karotte', 'Ananas', 'Kirsche', 'Zitrone', 'Kuchen', 'Donut',
    'Eistüte', 'Popcorn', 'Burger', 'Taco', 'Sushi', 'Käse', 'Brot', 'Fisch', 'Wal', 'Krake',
    'Schildkröte', 'Pinguin', 'Eule', 'Elefant', 'Giraffe', 'Löwe', 'Affe', 'Schnecke', 'Schmetterling', 'Biene',
    'Drache', 'Gespenst', 'Einhorn', 'Taschenlampe', 'Kerze', 'Lagerfeuer', 'Magnet', 'Mikroskop', 'Teleskop', 'Thermometer',
    'Schild', 'Flagge', 'Zelt', 'Zaun', 'Ampel', 'Brunnen', 'Windmühle', 'Iglu', 'Pyramide', 'Schlange',
    'Frosch', 'Hase', 'Pferd', 'Ente', 'Schwein', 'Kuh', 'Käfer', 'Raumschiff', 'Glocke', 'Marienkäfer',
];

$abstract = [
    'Sprint', 'Backlog', 'Retrospektive', 'Frist', 'Deployment', 'Daily', 'Geschwindigkeit', 'Schätzung', 'Feedback', 'Refactoring',
    'Pull-Request', 'Code-Review', 'Merge-Konflikt', 'Release', 'Roadmap', 'Meilenstein', 'Stakeholder', 'Product Owner', 'Scrum Master', 'User Story',
    'Epic', 'Definition of Done', 'Burndown', 'Kanban', 'Arbeitsablauf', 'Priorität', 'Blocker', 'Abhängigkeit', 'technische Schulden', 'Hotfix',
    'Rollback', 'Datenbank', 'Algorithmus', 'Variable', 'Funktion', 'Framework', 'Bibliothek', 'Compiler', 'Debugger', 'Syntax',
    'Ausnahme', 'Zeitüberschreitung', 'Latenz', 'Bandbreite', 'Passwort', 'Firewall', 'Verschlüsselung', 'Backup', 'Version', 'Branch',
    'Commit', 'Repository', 'Pipeline', 'Container', 'Migration', 'Prototyp', 'Wireframe', 'Benutzbarkeit', 'Barrierefreiheit', 'Einarbeitung',
    'Besprechung', 'Tagesordnung', 'Brainstorming', 'Workshop', 'Präsentation', 'Budget', 'Rechnung', 'Strategie', 'Vision', 'Innovation',
    'Zusammenarbeit', 'Vertrauen', 'Empathie', 'Motivation', 'Konzentration', 'Geduld', 'Neugier', 'Mut', 'Teamgeist', 'Konsens',
    'Kompromiss', 'Entscheidung', 'Experiment', 'Hypothese', 'Kennzahl', 'Erkenntnis', 'Iteration', 'Inkrement', 'Umfang', 'Qualität',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
