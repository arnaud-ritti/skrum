<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;

const FormalRegisterPatterns = [
    'fr' => '/\b(vous|votre|vos|vôtres?|veuillez|cliquez|saisissez|choisissez|utilisez|vérifiez|réessayez|essayez|connectez|ajoutez|créez|entrez|sélectionnez|patientez|demandez|copiez|collez|enregistrez|appuyez)\b/iu',
    'es' => '/\b(usted|ustedes|haga clic|introduzca|seleccione|inténtelo|únase|inicie sesión)\b/iu',
    'de' => '/\b(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/u',
];

/**
 * Values that keep a formal-looking word on purpose: a plural "vous" addressed to a whole team or channel,
 * a noun, or a German third person ("sie", "ihre") at the start of a sentence.
 */
const FormalRegisterAllowList = [
    'fr' => [
        'Plusieurs points demandent de l’attention. Choisissez-en un à améliorer.',
        'Le but vers lequel nous naviguons — mettez-vous d’accord dessus avant le reste',
        'rendez-vous',
    ],
    'es' => [],
    'de' => [
        'Ihre Antworten, Reaktionen und Kommentare werden ebenfalls gelöscht.',
        'Ihre Runden und Stimmen werden ebenfalls gelöscht.',
        'Das lässt sich nicht rückgängig machen. Ihre Kommentare und Unteraufgaben werden ebenfalls gelöscht.',
        'Sie war zu lange geöffnet, um sicher gesendet zu werden. Lade sie neu und versuch es noch einmal.',
        'Sie treten mit einem Spitznamen bei, ohne Konto',
        'Gib jedem Aktionspunkt eine verantwortliche Person und ein Fälligkeitsdatum. Sie bleiben auf der Aktionspunkte-Seite des Teams sichtbar.',
    ],
];

/**
 * @return array<int, string>
 */
function translatedValues(string $locale): array
{
    $values = array_values(File::json(lang_path("{$locale}.json")));

    foreach (File::files(lang_path($locale)) as $file) {
        $values = [...$values, ...array_values(Arr::dot(require $file->getPathname()))];
    }

    return array_values(array_filter($values, is_string(...)));
}

it('addresses the user informally in every translated text', function (string $locale) {
    $formal = array_values(array_filter(
        translatedValues($locale),
        fn (string $value): bool => preg_match(FormalRegisterPatterns[$locale], $value) === 1
            && ! in_array($value, FormalRegisterAllowList[$locale], true),
    ));

    expect($formal)->toBeEmpty();
})->with(['fr', 'es', 'de']);

it('keeps no stale entry in the allow-list of plural or third-person forms', function (string $locale) {
    expect(array_values(array_diff(FormalRegisterAllowList[$locale], translatedValues($locale))))->toBeEmpty();
})->with(['fr', 'es', 'de']);
