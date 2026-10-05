<?php

use App\Mail\MagicLinkMail;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

const ElidablePlaceholderPattern = '/(?<!\p{L})(de|que|le|la|je|ne|se|jusque|lorsque|puisque) :(\w+)/iu';

/**
 * Every French line, keyed as __() reads it, that puts an elidable word right before a placeholder.
 * The validator replaces its placeholders itself, without the translator: validation.php has its own test.
 *
 * @return array<string, string>
 */
function frenchLinesWithElidablePlaceholders(): array
{
    $lines = File::json(lang_path('fr.json'));

    foreach (File::files(lang_path('fr')) as $file) {
        if ($file->getFilenameWithoutExtension() === 'validation') {
            continue;
        }

        foreach (Arr::dot(require $file->getPathname()) as $key => $line) {
            $lines["{$file->getFilenameWithoutExtension()}.{$key}"] = $line;
        }
    }

    return array_filter($lines, fn (mixed $line): bool => is_string($line) && preg_match(ElidablePlaceholderPattern, $line) === 1);
}

/**
 * @return array<string, string>
 */
function everyPlaceholderOf(string $line, string $value): array
{
    preg_match_all('/:(\w+)/u', $line, $matches);

    return array_fill_keys($matches[1], $value);
}

it('finds French lines that put an elidable word before a placeholder', function () {
    expect(count(frenchLinesWithElidablePlaceholders()))->toBeGreaterThan(50);
});

it('elides every such French line before a vowel and keeps it before a consonant', function () {
    foreach (frenchLinesWithElidablePlaceholders() as $key => $line) {
        $withVowel = Str::lower(__($key, everyPlaceholderOf($line, 'Inès'), 'fr'));
        $withConsonant = Str::lower(__($key, everyPlaceholderOf($line, 'Marc'), 'fr'));

        preg_match_all(ElidablePlaceholderPattern, $line, $matches);

        foreach ($matches[1] as $word) {
            $word = Str::lower($word);

            expect(str_contains($withVowel, Str::substr($word, 0, -1)."'inès"))->toBeTrue("{$key} keeps “{$word}” before a vowel")
                ->and(str_contains($withConsonant, "{$word} marc"))->toBeTrue("{$key} elides “{$word}” before a consonant");
        }
    }
});

it('elides in the French turn banner and leaves English alone', function () {
    expect(__(':name\'s turn', ['name' => 'Arnaud Ritti'], 'fr'))->toBe("Tour d'Arnaud Ritti")
        ->and(__(':name\'s turn', ['name' => 'Marc'], 'fr'))->toBe('Tour de Marc')
        ->and(__('Join :workspace as :name?', ['workspace' => 'Atlas', 'name' => 'Inès'], 'fr'))->toBe("Rejoindre Atlas en tant qu'Inès\u{a0}?")
        ->and(__('Copy of :name', ['name' => 'Atlas'], 'en'))->toBe('Copy of Atlas');
});

it('elides with the locale the app runs in when none is passed', function () {
    app()->setLocale('fr');

    expect(__('Copy of :name', ['name' => 'Atlas']))->toBe("Copie d'Atlas")
        ->and(__('Overdue by :count days', ['count' => 2]))->toBe('En retard de 2 jours');
});

it('keeps elidable words away from the names the validator puts in a French message', function () {
    $lines = Arr::dot(Arr::except(require lang_path('fr/validation.php'), ['attributes']));

    $needingElision = array_filter(
        $lines,
        fn (mixed $line): bool => is_string($line) && preg_match('/(?<!\p{L})(de|que|le|la|je|ne|se|jusque|lorsque|puisque) :(attribute|other|values)\b/iu', $line) === 1,
    );

    expect(array_keys($needingElision))->toBe([]);
});

it('reads well in a French validation message about a field that starts with a vowel', function () {
    app()->setLocale('fr');

    $errors = Validator::make(
        ['email' => 'trop-long@example.test', 'age' => 3],
        ['email' => ['max:5'], 'age' => ['integer', 'gte:5']],
    )->errors();

    expect($errors->first('email'))->toBe('Le texte du champ adresse e-mail ne peut pas contenir plus de 5 caractères.')
        ->and($errors->first('age'))->toBe('La valeur du champ âge doit être supérieure ou égale à 5.');
});

it('elides before the address in the French magic link mail', function () {
    $mail = (new MagicLinkMail('https://skrum.test/x', 'arnaud@example.test', 15))->locale('fr');

    $mail->assertSeeInHtml('te connecter en tant qu&#039;<strong>arnaud@example.test</strong>.', false)
        ->assertSeeInText("te connecter en tant qu'arnaud@example.test.");
});
