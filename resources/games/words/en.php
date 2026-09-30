<?php

$drawable = [
    'laptop', 'keyboard', 'mouse', 'monitor', 'printer', 'coffee cup', 'pizza', 'sandwich', 'cookie', 'banana',
    'apple', 'rocket', 'robot', 'spider', 'whiteboard', 'sticky note', 'marker', 'pencil', 'scissors', 'stapler',
    'paperclip', 'calendar', 'clock', 'alarm clock', 'hourglass', 'stopwatch', 'trophy', 'medal', 'crown', 'lightbulb',
    'battery', 'plug', 'headphones', 'microphone', 'camera', 'smartphone', 'satellite', 'antenna', 'server rack', 'cloud',
    'umbrella', 'rainbow', 'sun', 'moon', 'star', 'planet', 'volcano', 'mountain', 'island', 'bridge',
    'lighthouse', 'castle', 'house', 'desk', 'chair', 'sofa', 'lamp', 'window', 'door', 'key',
    'padlock', 'wallet', 'coin', 'piggy bank', 'backpack', 'suitcase', 'briefcase', 'envelope', 'mailbox', 'newspaper',
    'book', 'notebook', 'map', 'compass', 'anchor', 'sailboat', 'submarine', 'train', 'bicycle', 'scooter',
    'car', 'bus', 'truck', 'tractor', 'helicopter', 'airplane', 'parachute', 'balloon', 'kite', 'ladder',
    'hammer', 'wrench', 'screwdriver', 'saw', 'shovel', 'bucket', 'broom', 'toothbrush', 'glasses', 'hat',
    'tie', 'shirt', 'sock', 'boot', 'glove', 'scarf', 'ring', 'guitar', 'piano', 'drum',
    'trumpet', 'violin', 'football', 'basketball', 'skateboard', 'dice', 'puzzle', 'teddy bear', 'snowman', 'cactus',
    'flower', 'tree', 'leaf', 'mushroom', 'carrot', 'pineapple', 'cherry', 'lemon', 'cake', 'donut',
    'ice cream', 'popcorn', 'burger', 'taco', 'sushi', 'cheese', 'bread', 'fish', 'whale', 'octopus',
    'turtle', 'penguin', 'owl', 'elephant', 'giraffe', 'lion', 'monkey', 'snail', 'butterfly', 'bee',
    'dragon', 'ghost', 'unicorn', 'flashlight', 'candle', 'campfire', 'magnet', 'microscope', 'telescope', 'thermometer',
    'shield', 'flag', 'tent', 'fence', 'traffic light', 'fountain', 'windmill', 'igloo', 'pyramid', 'snake',
    'frog', 'rabbit', 'horse', 'duck', 'pig', 'cow', 'bug', 'spaceship', 'bell', 'ladybug',
];

$abstract = [
    'sprint', 'backlog', 'retrospective', 'deadline', 'deployment', 'standup', 'velocity', 'estimate', 'feedback', 'refactoring',
    'pull request', 'code review', 'merge conflict', 'release', 'roadmap', 'milestone', 'stakeholder', 'product owner', 'scrum master', 'user story',
    'epic', 'definition of done', 'burndown', 'kanban', 'workflow', 'priority', 'blocker', 'dependency', 'technical debt', 'hotfix',
    'rollback', 'database', 'algorithm', 'variable', 'function', 'framework', 'library', 'compiler', 'debugger', 'syntax',
    'exception', 'timeout', 'latency', 'bandwidth', 'password', 'firewall', 'encryption', 'backup', 'version', 'branch',
    'commit', 'repository', 'pipeline', 'container', 'migration', 'prototype', 'wireframe', 'usability', 'accessibility', 'onboarding',
    'meeting', 'agenda', 'brainstorm', 'workshop', 'presentation', 'budget', 'invoice', 'strategy', 'vision', 'innovation',
    'collaboration', 'trust', 'empathy', 'motivation', 'focus', 'patience', 'curiosity', 'courage', 'teamwork', 'consensus',
    'compromise', 'decision', 'experiment', 'hypothesis', 'metric', 'insight', 'iteration', 'increment', 'scope', 'quality',
];

return [
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => true], $drawable),
    ...array_map(fn (string $word): array => ['word' => $word, 'drawable' => false], $abstract),
];
