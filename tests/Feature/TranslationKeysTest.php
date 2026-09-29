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
        ...File::allFiles(resource_path('js/hooks')),
        ...File::allFiles(resource_path('js/lib')),
        ...File::allFiles(app_path()),
    ])->filter(fn (SplFileInfo $file) => in_array($file->getExtension(), ['ts', 'tsx', 'php'], true));

    return $files
        ->flatMap(function (SplFileInfo $file) use ($patterns) {
            $source = File::get($file->getPathname());

            return collect($patterns)
                ->flatMap(function (string $pattern) use ($source) {
                    preg_match_all($pattern, $source, $matches);

                    return $matches[1];
                })
                ->merge(ternaryTranslationKeys($source))
                ->map(fn (string $key) => stripslashes($key));
        })
        ->unique()
        ->values()
        ->all();
}

/**
 * Keys chosen by a ternary inside the call, e.g. `t(isOpen ? 'Close' : 'Open')`.
 *
 * @return array<int, string>
 */
function ternaryTranslationKeys(string $source): array
{
    preg_match_all('/(?<![\w.$])(?:t|__)\(/', $source, $calls, PREG_OFFSET_CAPTURE);

    return collect($calls[0])
        ->flatMap(function (array $call) use ($source) {
            $argument = translationCallArgument($source, $call[1] + strlen($call[0]));

            if (! str_contains($argument, '?')) {
                return [];
            }

            preg_match_all('/[?:]\s*([\'"])((?:(?!\1)[^\\\\]|\\\\.)+)\1/', $argument, $matches);

            return $matches[2];
        })
        ->all();
}

function translationCallArgument(string $source, int $start): string
{
    $depth = 0;
    $quote = null;

    for ($index = $start; $index < strlen($source); $index++) {
        $character = $source[$index];

        if ($quote !== null) {
            if ($character === '\\') {
                $index++;

                continue;
            }

            if ($character === $quote) {
                $quote = null;
            }

            continue;
        }

        if (in_array($character, ["'", '"', '`'], true)) {
            $quote = $character;

            continue;
        }

        if (in_array($character, ['(', '[', '{'], true)) {
            $depth++;

            continue;
        }

        if ($depth === 0 && in_array($character, [',', ')'], true)) {
            return substr($source, $start, $index - $start);
        }

        if (in_array($character, [')', ']', '}'], true)) {
            $depth--;
        }
    }

    return '';
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
