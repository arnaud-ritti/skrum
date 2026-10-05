<?php

use Symfony\Component\Finder\Finder;

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
    $components = [];
    $files = Finder::create()->files()->in("{$root}/resources/js/pages")->name('*.tsx')->notName('*.test.tsx')->notPath('#^dev/sections/#');

    foreach ($files as $file) {
        $components[] = substr($file->getRelativePathname(), 0, -strlen('.tsx'));
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

    foreach (Finder::create()->files()->in(["{$root}/app", "{$root}/routes", "{$root}/bootstrap"])->name('*.php') as $file) {
        preg_match_all(
            '/(?:Inertia::render|Route::inertia|\binertia)\(\s*(?:[\'"][^\'"]*[\'"]\s*,\s*)?[\'"]([\w\/-]+)[\'"]/',
            $file->getContents(),
            $matches,
        );

        $components = [...$components, ...$matches[1]];
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
