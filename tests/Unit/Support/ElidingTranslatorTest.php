<?php

use App\Support\ElidingTranslator;

it('elides the word before a name that starts with a vowel', function (string $line, string $expected) {
    expect(ElidingTranslator::elide($line, ['name' => 'Inès']))->toBe($expected);
})->with([
    ['Tour de :name', "Tour d':name"],
    ['Plus que :name', "Plus qu':name"],
    ['Voir le :name', "Voir l':name"],
    ['Voir la :name', "Voir l':name"],
    ['De :name à toi', "D':name à toi"],
    ['Attends jusque :name', "Attends jusqu':name"],
]);

it('elides before an accented capital, a ligature or a lower-case vowel', function (string $value) {
    expect(ElidingTranslator::elide('Tour de :name', ['name' => $value]))->toBe("Tour d':name");
})->with(['Élodie', 'Œdipe', 'arnaud', 'Ulysse']);

it('keeps the full word before a consonant, a digit, an h or an empty value', function (mixed $value) {
    expect(ElidingTranslator::elide('Tour de :name', ['name' => $value]))->toBe('Tour de :name');
})->with(['Marc', '8 octobre', 'Hugo', 'https://chat.example.com', '', null, 3]);

it('leaves a word that only ends like an elidable one', function () {
    expect(ElidingTranslator::elide('Le monde :name', ['name' => 'Inès']))->toBe('Le monde :name');
});

it('elides only before its own placeholder, not a longer one that starts the same', function () {
    expect(ElidingTranslator::elide('de :first à :firstLabel, de :firstLabel', ['first' => 'Marc', 'firstLabel' => 'avril']))
        ->toBe("de :first à :firstLabel, d':firstLabel");
});

it('reads a backed enum by its value', function () {
    expect(ElidingTranslator::elide('Tour de :name', ['name' => ElidingTranslatorTestName::Ines]))->toBe("Tour d':name");
});

enum ElidingTranslatorTestName: string
{
    case Ines = 'Inès';
}
