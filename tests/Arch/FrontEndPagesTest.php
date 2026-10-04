<?php

/**
 * Pages no PHP file renders by a literal name, with the reason (for instance
 * an error page whose name the exception handler builds from the status code).
 */
const PagesRenderedIndirectly = [
    'errors/error' => 'app/Http/ErrorPageResponder.php renders its Component constant',
];

/**
 * @return array<int, string> Inertia component names, e.g. `retros/show`
 */
function pageComponents(string $root): array
{
    $pages = "{$root}/resources/js/pages";
    $components = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($pages, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        $component = substr($file->getPathname(), strlen($pages) + 1, -strlen('.tsx'));

        if ($file->getExtension() !== 'tsx' || str_ends_with($component, '.test') || str_starts_with($component, 'dev/sections/')) {
            continue;
        }

        $components[] = $component;
    }

    sort($components);

    return $components;
}

/**
 * @return array<int, string> Inertia components named in the PHP sources
 */
function renderedComponents(string $root): array
{
    $components = [];

    foreach (['app', 'routes', 'bootstrap'] as $folder) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("{$root}/{$folder}", FilesystemIterator::SKIP_DOTS));

        foreach ($files as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            preg_match_all(
                '/(?:Inertia::render|Route::inertia|\binertia)\(\s*(?:[\'"][^\'"]*[\'"]\s*,\s*)?[\'"]([\w\/-]+)[\'"]/',
                (string) file_get_contents($file->getPathname()),
                $matches,
            );

            $components = [...$components, ...$matches[1]];
        }
    }

    $components = array_values(array_unique($components));
    sort($components);

    return $components;
}

it('has a page file for every component the server renders, and renders every page file', function () {
    $root = dirname(__DIR__, 2);
    $pages = pageComponents($root);
    $rendered = renderedComponents($root);

    expect($pages)->not->toBeEmpty()
        ->and(array_values(array_diff($rendered, $pages)))->toBeEmpty()
        ->and(array_values(array_diff($pages, $rendered, array_keys(PagesRenderedIndirectly))))->toBeEmpty()
        ->and(array_values(array_diff(array_keys(PagesRenderedIndirectly), $pages)))->toBeEmpty();
});
