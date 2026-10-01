<?php

it('starts the stylesheet with the design-system file, unmodified', function () {
    $reference = file_get_contents(base_path('docs/design-system/app.css'));
    $stylesheet = file_get_contents(resource_path('css/app.css'));

    expect(str_starts_with($stylesheet, rtrim($reference)))->toBeTrue();
});

it('keeps the whiteboard overrides after the tokens', function () {
    $stylesheet = file_get_contents(resource_path('css/app.css'));

    expect($stylesheet)
        ->toContain('.excalidraw .default-sidebar-trigger')
        ->toContain(".whiteboard-canvas[data-facilitator='false']");
});

it('paints the first frame with the token backgrounds', function () {
    $stylesheet = file_get_contents(resource_path('css/app.css'));
    $view = file_get_contents(resource_path('views/app.blade.php'));

    $background = function (string $selector) use ($stylesheet): string {
        preg_match('/^'.preg_quote($selector, '/').'\s*\{[^}]*?--background:\s*([^;]+);/m', $stylesheet, $matches);

        return trim($matches[1] ?? '');
    };

    expect($background(':root'))->not->toBeEmpty()
        ->and($background('.dark'))->not->toBeEmpty()
        ->and($background('.dark'))->not->toBe($background(':root'))
        ->and($view)
        ->toContain("background-color: {$background(':root')}")
        ->toContain("background-color: {$background('.dark')}")
        ->not->toContain('@fonts');
});
