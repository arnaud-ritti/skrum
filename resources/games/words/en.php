<?php

$themes = [
    'work' => [
        'drawable' => [
            'laptop', 'keyboard', 'mouse', 'monitor', 'printer', 'coffee cup', 'rocket', 'robot', 'whiteboard', 'sticky note',
            'marker', 'pencil', 'scissors', 'stapler', 'paperclip', 'calendar', 'clock', 'alarm clock', 'hourglass', 'stopwatch',
            'trophy', 'medal', 'lightbulb', 'battery', 'plug', 'headphones', 'microphone', 'camera', 'smartphone', 'satellite',
            'antenna', 'server rack', 'desk', 'chair', 'lamp', 'briefcase', 'envelope', 'notebook', 'magnet', 'microscope',
            'telescope', 'thermometer', 'spaceship',
        ],
        'abstract' => [
            'sprint', 'backlog', 'retrospective', 'deadline', 'deployment', 'standup', 'velocity', 'estimate', 'feedback', 'refactoring',
            'pull request', 'code review', 'merge conflict', 'release', 'roadmap', 'milestone', 'stakeholder', 'product owner', 'scrum master', 'user story',
            'epic', 'definition of done', 'burndown', 'kanban', 'workflow', 'priority', 'blocker', 'dependency', 'technical debt', 'hotfix',
            'rollback', 'database', 'algorithm', 'variable', 'function', 'framework', 'library', 'compiler', 'debugger', 'syntax',
            'exception', 'timeout', 'latency', 'bandwidth', 'password', 'firewall', 'encryption', 'backup', 'version', 'branch',
            'commit', 'repository', 'pipeline', 'container', 'migration', 'prototype', 'wireframe', 'usability', 'accessibility', 'onboarding',
            'meeting', 'agenda', 'brainstorm', 'workshop', 'presentation', 'budget', 'invoice', 'strategy', 'vision', 'innovation',
            'collaboration', 'trust', 'empathy', 'motivation', 'focus', 'patience', 'curiosity', 'courage', 'teamwork', 'consensus',
            'compromise', 'decision', 'experiment', 'hypothesis', 'metric', 'insight', 'iteration', 'increment', 'scope', 'quality',
        ],
    ],
    'food' => [
        'drawable' => [
            'pizza', 'sandwich', 'cookie', 'banana', 'apple', 'carrot', 'pineapple', 'cherry', 'lemon', 'cake',
            'donut', 'ice cream', 'popcorn', 'burger', 'taco', 'sushi', 'cheese', 'bread',
        ],
    ],
    'nature' => [
        'drawable' => [
            'spider', 'cloud', 'rainbow', 'sun', 'moon', 'star', 'planet', 'volcano', 'mountain', 'island',
            'cactus', 'flower', 'tree', 'leaf', 'mushroom', 'fish', 'whale', 'octopus', 'turtle', 'penguin',
            'owl', 'elephant', 'giraffe', 'lion', 'monkey', 'snail', 'butterfly', 'bee', 'snake', 'frog',
            'rabbit', 'horse', 'duck', 'pig', 'cow', 'bug', 'ladybug',
        ],
    ],
    'objects' => [
        'drawable' => [
            'crown', 'umbrella', 'bridge', 'lighthouse', 'castle', 'house', 'sofa', 'window', 'door', 'key',
            'padlock', 'wallet', 'coin', 'piggy bank', 'backpack', 'suitcase', 'mailbox', 'newspaper', 'book', 'map',
            'compass', 'anchor', 'sailboat', 'submarine', 'train', 'bicycle', 'scooter', 'car', 'bus', 'truck',
            'tractor', 'helicopter', 'airplane', 'parachute', 'balloon', 'kite', 'ladder', 'hammer', 'wrench', 'screwdriver',
            'saw', 'shovel', 'bucket', 'broom', 'toothbrush', 'glasses', 'hat', 'tie', 'shirt', 'sock',
            'boot', 'glove', 'scarf', 'ring', 'guitar', 'piano', 'drum', 'trumpet', 'violin', 'football',
            'basketball', 'skateboard', 'dice', 'puzzle', 'teddy bear', 'snowman', 'dragon', 'ghost', 'unicorn', 'flashlight',
            'candle', 'campfire', 'shield', 'flag', 'tent', 'fence', 'traffic light', 'fountain', 'windmill', 'igloo',
            'pyramid', 'bell',
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
