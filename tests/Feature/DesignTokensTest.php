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
    $view = file_get_contents(resource_path('views/app.blade.php'));

    expect($view)
        ->toContain('background-color: oklch(0.985 0.004 80)')
        ->toContain('background-color: oklch(0.165 0.008 55)')
        ->not->toContain('@fonts');
});
