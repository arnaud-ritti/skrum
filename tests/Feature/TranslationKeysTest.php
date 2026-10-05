<?php

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;

function usedTranslationKeys(): array
{
    $patterns = [
        '/\bt\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
        '/\bt\(\s*"((?:[^"\\\\]|\\\\.)+)"/',
        '/__\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
        '/__\(\s*"((?:[^"\\\\$]|\\\\.)+)"/',
        '/\b(?:trans|trans_choice)\(\s*\'((?:[^\'\\\\]|\\\\.)+)\'/',
        '/\b(?:trans|trans_choice)\(\s*"((?:[^"\\\\$]|\\\\.)+)"/',
    ];

    $files = collect([
        ...File::allFiles(resource_path('js/pages')),
        ...File::allFiles(resource_path('js/components')),
        ...File::allFiles(resource_path('js/layouts')),
        ...File::allFiles(resource_path('js/hooks')),
        ...File::allFiles(resource_path('js/lib')),
        ...File::allFiles(app_path()),
        ...File::allFiles(resource_path('views')),
    ])->filter(fn (SplFileInfo $file) => in_array($file->getExtension(), ['ts', 'tsx', 'php'], true)
        && preg_match('/\.test\.tsx?$/', $file->getFilename()) !== 1);

    return $files
        ->flatMap(function (SplFileInfo $file) use ($patterns) {
            $source = File::get($file->getPathname());

            return collect($patterns)
                ->flatMap(function (string $pattern) use ($source): array {
                    preg_match_all($pattern, $source, $matches);

                    return $matches[1];
                })
                ->merge(ternaryTranslationKeys($source))
                ->map(fn (string $key) => stripslashes($key))
                ->reject(fn (string $key): bool => preg_match('/^[a-z_-]+(\.[\w-]+)+$/', $key) === 1);
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
        ->flatMap(function (array $call) use ($source): array {
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

    expect($missingKeys)->toBeEmpty();
})->with(['en', 'fr', 'es', 'de']);

it('keeps every english key in every other locale', function (string $locale) {
    $englishKeys = array_keys(json_decode(File::get(lang_path('en.json')), true));
    $localeKeys = array_keys(json_decode(File::get(lang_path("{$locale}.json")), true));

    expect(array_values(array_diff($englishKeys, $localeKeys)))->toBeEmpty();
})->with(['fr', 'es', 'de']);

it('words an english key differently from its text only where that is meant', function () {
    $english = json_decode(File::get(lang_path('en.json')), true);

    $reworded = array_filter($english, fn (string $text, string $key): bool => $text !== $key, ARRAY_FILTER_USE_BOTH);

    expect($reworded)->toBe([
        'Built-in survey' => 'Built-in',
        'Open the team' => 'Open',
        'Finished sprint' => 'Finished',
        'Done status' => 'Done',
        'ROTI voter thinking' => 'Thinking',
        'Two-factor on' => 'On',
        'Two-factor off' => 'Off',
        'Survey builder settings' => 'Settings',
        'Rounds per game' => 'Rounds',
        'Upcoming sessions' => 'Upcoming',
        'Live sessions' => 'Live',
        'Finished sessions' => 'Finished',
        'Two truths: truth initial' => 'T',
        'Two truths: lie initial' => 'L',
        'Remove person :name' => 'Remove :name',
        'Invite step' => 'Invite',
    ]);
});

it('keeps every template line in every other locale', function (string $locale) {
    $english = array_keys(Arr::dot(require lang_path('en/templates.php')));
    $translated = array_keys(Arr::dot(require lang_path("{$locale}/templates.php")));

    expect(array_values(array_diff($english, $translated)))->toBeEmpty()
        ->and(array_values(array_diff($translated, $english)))->toBeEmpty();
})->with(['fr', 'es', 'de']);

/**
 * Files where `t()` receives a value the scan cannot follow, with the place that guarantees the keys exist.
 */
const DynamicTranslationSources = [
    'resources/js/layouts/skrum/auth-layout.tsx' => 'title and description are layout props of the auth pages, which the layout-prop test covers',
    'resources/js/components/admin/branding/palette-warnings.tsx' => 'warning keys are built by BrandPalette; tests/Unit/Branding/BrandPaletteTest.php checks them in the four files',
    'resources/js/components/settings/security/two-factor-card.tsx' => 'messages set by use-two-factor-auth.ts, which TranslationKeysHeldAsData covers',
];

/**
 * Files that hold translation keys as data another file hands to `t()`, with the pattern that captures each key.
 */
const TranslationKeysHeldAsData = [
    'resources/js/hooks/use-two-factor-auth.ts' => '/setErrors\(\(prev\) => \[\.\.\.prev, \'((?:[^\'\\\\]|\\\\.)+)\'\]\)/',
];

/**
 * @return array<string, array<int, string>> keys by file of TranslationKeysHeldAsData
 */
function translationKeysHeldAsData(): array
{
    $keys = [];

    foreach (TranslationKeysHeldAsData as $path => $pattern) {
        preg_match_all($pattern, is_file(base_path($path)) ? File::get(base_path($path)) : '', $matches);

        $keys[$path] = array_map(stripslashes(...), $matches[1]);
    }

    return $keys;
}

/**
 * @return array<string, string> TypeScript source by path relative to the repository, tests left out
 */
function translationSources(): array
{
    $sources = [];

    foreach (['pages', 'components', 'layouts', 'hooks', 'lib'] as $folder) {
        foreach (File::allFiles(resource_path("js/{$folder}")) as $file) {
            if (! in_array($file->getExtension(), ['ts', 'tsx'], true) || preg_match('/\.test\.tsx?$/', $file->getFilename()) === 1) {
                continue;
            }

            $sources[str_replace(base_path().'/', '', $file->getPathname())] = File::get($file->getPathname());
        }
    }

    ksort($sources);

    return $sources;
}

/**
 * The text between the bracket at $opener and the bracket that closes it.
 */
function bracketedLiteral(string $source, int $opener): string
{
    $depth = 0;
    $quote = null;

    for ($index = $opener; $index < strlen($source); $index++) {
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

        if (! in_array($character, [')', ']', '}'], true)) {
            continue;
        }

        if (--$depth === 0) {
            return substr($source, $opener + 1, $index - $opener - 1);
        }
    }

    return '';
}

/**
 * The string values of a module-level `const NAME = { … }` or `const NAME = [ … ]`, or null when there is no such literal.
 *
 * @return null|array<int, string>
 */
function labelMapValues(string $source, string $name): ?array
{
    if (preg_match('/^(?:export\s+)?const\s+'.preg_quote($name, '/').'\b[^=\n]*=\s*([{\[])/m', $source, $match, PREG_OFFSET_CAPTURE) !== 1) {
        return null;
    }

    $literal = bracketedLiteral($source, $match[1][1]);
    $string = '([\'"])((?:(?!\1)[^\\\\\n]|\\\\.)+)\1';

    preg_match_all($match[1][0] === '{' ? "/:\s*{$string}/" : "/{$string}(?!\s*:)/", $literal, $values);

    return array_map(stripslashes(...), $values[2]);
}

/**
 * Layout props a page hands to its layout as literals (`Login.layout = { title: '…', description: '…' }`,
 * breadcrumb titles included): the layout translates them.
 *
 * @param  array<string, string>  $sources
 * @return array<int, string>
 */
function layoutPropTranslationKeys(array $sources): array
{
    $keys = [];

    foreach ($sources as $source) {
        preg_match_all('/^\w+\.layout\s*=\s*\{/m', $source, $blocks, PREG_OFFSET_CAPTURE);

        foreach ($blocks[0] as [$opening, $offset]) {
            $literal = bracketedLiteral($source, $offset + strlen($opening) - 1);

            preg_match_all('/\b(?:title|description)\s*:\s*([\'"])((?:(?!\1)[^\\\\\n]|\\\\.)+)\1/', $literal, $values);

            $keys = [...$keys, ...array_map(stripslashes(...), $values[2])];
        }
    }

    return array_values(array_unique($keys));
}

/**
 * Calls such as `t(PhaseLabels[phase])` or `t(roleLabels.owner)`: the keys are the string values of the map.
 *
 * @param  array<string, string>  $sources
 * @return array{
 *     keys: array<int, string>,
 *     unresolved: array<int, string>
 * }
 */
function dynamicTranslationCalls(array $sources): array
{
    $keys = [];
    $unresolved = [];

    foreach ($sources as $path => $source) {
        preg_match_all('/(?<![\w.$])t\(\s*([A-Za-z_$][\w$]*)\s*([\[.,)])/', $source, $calls, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        foreach ($calls as $call) {
            $argument = translationCallArgument($source, $call[0][1] + strlen('t('));

            if (str_contains($argument, '?')) {
                continue;
            }

            $name = $call[1][0];
            $values = labelMapValues($source, $name);

            foreach ($values === null ? $sources : [] as $other) {
                if (preg_match('/^export\s+const\s+'.preg_quote($name, '/').'\b/m', $other) === 1) {
                    $values = labelMapValues($other, $name);

                    break;
                }
            }

            if ($values === null) {
                $line = substr_count($source, "\n", 0, $call[0][1]) + 1;
                $unresolved[] = "{$path}:{$line} t(".trim($argument).')';

                continue;
            }

            $keys = [...$keys, ...$values];
        }
    }

    return ['keys' => array_values(array_unique($keys)), 'unresolved' => $unresolved];
}

it('defines the keys of every label map and of every layout prop in every locale', function (string $locale) {
    $translations = json_decode(File::get(lang_path("{$locale}.json")), true);
    $sources = translationSources();
    $keys = [...dynamicTranslationCalls($sources)['keys'], ...layoutPropTranslationKeys($sources)];

    expect(array_values(array_diff($keys, array_keys($translations))))->toBeEmpty();
})->with(['en', 'fr', 'es', 'de']);

it('defines the keys held as data in every locale', function (string $locale) {
    $translations = json_decode(File::get(lang_path("{$locale}.json")), true);
    $keys = array_merge(...array_values(translationKeysHeldAsData()));

    expect(array_values(array_diff($keys, array_keys($translations))))->toBeEmpty();
})->with(['en', 'fr', 'es', 'de']);

it('finds keys in every file said to hold them as data', function () {
    expect(array_keys(array_filter(translationKeysHeldAsData(), fn (array $keys): bool => $keys === [])))->toBeEmpty();
});

it('knows where the keys of every other dynamic call come from', function () {
    $files = array_values(array_unique(array_map(
        fn (string $call): string => explode(':', $call)[0],
        dynamicTranslationCalls(translationSources())['unresolved'],
    )));

    expect(array_values(array_diff($files, array_keys(DynamicTranslationSources))))->toBeEmpty()
        ->and(array_values(array_diff(array_keys(DynamicTranslationSources), $files)))->toBeEmpty();
});

it('reads the keys of a label map, of a label list and of layout props', function () {
    $sources = [
        'a.tsx' => "export const PhaseLabels: Record<string, string> = {\n    writing: 'Writing',\n    done: \"It's done\",\n};\nconst Scores = ['Time wasted', 'Excellent'] as const;\nfunction A() { return t(Scores[score - 1]) + t(isOpen ? 'Close' : 'Open'); }\nA.layout = {\n    title: 'Log in to your account',\n    breadcrumbs: [{ title: 'Profile settings', href: edit() }],\n};\n",
        'b.tsx' => "function B({ item }) { return t(PhaseLabels[phase]) + t(item.title); }\n",
    ];

    $calls = dynamicTranslationCalls($sources);

    expect($calls['keys'])->toEqualCanonicalizing(['Time wasted', 'Excellent', 'Writing', "It's done"])
        ->and($calls['unresolved'])->toBe(['b.tsx:1 t(item.title)'])
        ->and(layoutPropTranslationKeys($sources))->toBe(['Log in to your account', 'Profile settings']);
});
