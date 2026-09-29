<?php

use Illuminate\Support\Facades\File;

function usedTranslationKeys(): array
{
    $patterns = [
        '/\bt\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
        '/\bt\(\s*"((?:[^"\\\\]|\\\\.)+)"/',
        '/__\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
    ];

    $files = collect([
        ...File::allFiles(resource_path('js/pages')),
        ...File::allFiles(resource_path('js/components')),
        ...File::allFiles(resource_path('js/layouts')),
        ...File::allFiles(app_path()),
    ])->filter(fn (SplFileInfo $file) => in_array($file->getExtension(), ['ts', 'tsx', 'php'], true));

    return $files
        ->flatMap(function (SplFileInfo $file) use ($patterns) {
            return collect($patterns)->flatMap(function (string $pattern) use ($file) {
                preg_match_all($pattern, File::get($file->getPathname()), $matches);

                return array_map(fn (string $key) => stripslashes($key), $matches[1]);
            });
        })
        ->unique()
        ->values()
        ->all();
}

it('defines every used key in every locale', function (string $locale) {
    $translations = json_decode(File::get(lang_path("{$locale}.json")), true);

    $missingKeys = array_values(array_diff(usedTranslationKeys(), array_keys($translations)));

    expect($missingKeys)->toBe([]);
})->with(['en', 'fr', 'es', 'de']);

it('keeps every english key in every other locale', function (string $locale) {
    $englishKeys = array_keys(json_decode(File::get(lang_path('en.json')), true));
    $localeKeys = array_keys(json_decode(File::get(lang_path("{$locale}.json")), true));

    expect(array_values(array_diff($englishKeys, $localeKeys)))->toBe([]);
})->with(['fr', 'es', 'de']);
