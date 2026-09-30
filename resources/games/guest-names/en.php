<?php

$animals = ['Otter', 'Panda', 'Fox', 'Owl', 'Koala', 'Penguin', 'Tiger', 'Dolphin', 'Hedgehog', 'Rabbit', 'Falcon', 'Badger', 'Llama', 'Beaver', 'Squirrel', 'Turtle'];

$adjectives = ['Happy', 'Brave', 'Clever', 'Curious', 'Gentle', 'Jolly', 'Lucky', 'Calm', 'Swift', 'Bright', 'Cheerful', 'Witty', 'Kind', 'Bold', 'Sunny', 'Quiet'];

return [
    'pattern' => ':adjective :animal',
    'animals' => array_map(fn (string $name): array => ['name' => $name, 'gender' => 'n'], $animals),
    'adjectives' => array_map(fn (string $adjective): array => ['n' => $adjective], $adjectives),
];
