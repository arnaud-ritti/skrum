<?php

it('renders the design-system bench without overflow', function (string $section) {
    $this->captureVisuals("design-system-{$section}", "/dev/design-system/{$section}");
})->with(['tokens', 'app', 'session', 'settings', 'auth', 'onboarding']);

it('catches an element wider than the viewport', function () {
    $page = visit('/dev/design-system/tokens')->resize(390, 844);

    $page->script("() => { const wide = document.createElement('div'); wide.id = 'too-wide'; wide.style.width = '60rem'; wide.style.height = '1rem'; document.body.appendChild(wide); }");

    expect($this->overflowingElements($page))->toContain('div#too-wide');
});

it('ignores an element inside a scroller or marked as a deliberate scroller', function () {
    $page = visit('/dev/design-system/tokens')->resize(390, 844);

    $page->script("() => {
        const scroller = document.createElement('div');
        scroller.id = 'scroller';
        scroller.style.overflowX = 'auto';
        const inside = document.createElement('div');
        inside.id = 'inside-scroller';
        inside.style.width = '60rem';
        inside.style.height = '1rem';
        scroller.appendChild(inside);
        document.body.appendChild(scroller);

        const marked = document.createElement('div');
        marked.setAttribute('data-overflow-ok', '');
        const markedChild = document.createElement('div');
        markedChild.id = 'inside-marked';
        markedChild.style.width = '60rem';
        markedChild.style.height = '1rem';
        marked.appendChild(markedChild);
        document.body.appendChild(marked);
    }");

    $offenders = implode(' ', $this->overflowingElements($page));

    expect($offenders)->not->toContain('inside-scroller')->not->toContain('inside-marked');
});
