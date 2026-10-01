<?php

it('renders the design-system bench without overflow', function (string $section) {
    $this->captureVisuals(
        "design-system-{$section}",
        "/dev/design-system/{$section}",
        fn (string $path, array $options) => visit($path, $options)->assertPresent("[data-bench-section=\"{$section}\"]"),
    );
})->with(fn (): array => collect(glob(dirname(__DIR__, 3).'/resources/js/pages/dev/sections/*.tsx'))
    ->map(fn (string $path): string => basename($path, '.tsx'))
    ->filter(fn (string $name): bool => preg_match('/\A[a-z0-9-]+\z/', $name) === 1)
    ->sort()
    ->values()
    ->all());

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

it('catches an element cut by an ancestor that hides its overflow', function () {
    $page = visit('/dev/design-system/tokens')->resize(390, 844);

    $page->script("() => {
        const clipper = document.createElement('div');
        clipper.id = 'clipper';
        clipper.style.overflowX = 'hidden';
        const cut = document.createElement('div');
        cut.id = 'cut-by-clipper';
        cut.style.width = '60rem';
        cut.style.height = '1rem';
        clipper.appendChild(cut);
        document.body.appendChild(clipper);

        const clip = document.createElement('div');
        clip.style.overflowX = 'clip';
        const cutByClip = document.createElement('div');
        cutByClip.id = 'cut-by-clip';
        cutByClip.style.width = '60rem';
        cutByClip.style.height = '1rem';
        clip.appendChild(cutByClip);
        document.body.appendChild(clip);
    }");

    expect($this->overflowingElements($page))
        ->toContain('div#cut-by-clipper')
        ->toContain('div#cut-by-clip')
        ->not->toContain('div#clipper');
});

it('blames the hiding ancestor, not what fits inside it, when that ancestor is too wide', function () {
    $page = visit('/dev/design-system/tokens')->resize(390, 844);

    $page->script("() => {
        const wide = document.createElement('div');
        wide.id = 'wide-clipper';
        wide.style.overflowX = 'hidden';
        wide.style.width = '60rem';
        const inside = document.createElement('div');
        inside.id = 'fits-inside';
        inside.style.height = '1rem';
        wide.appendChild(inside);
        document.body.appendChild(wide);
    }");

    expect($this->overflowingElements($page))
        ->toContain('div#wide-clipper')
        ->not->toContain('div#fits-inside');
});

it('ignores a label truncated with an ellipsis', function () {
    $page = visit('/dev/design-system/tokens')->resize(390, 844);

    $page->script("() => {
        const label = document.createElement('div');
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.whiteSpace = 'nowrap';
        const text = document.createElement('span');
        text.id = 'truncated-text';
        text.textContent = 'A label far too long for its place. '.repeat(20);
        label.appendChild(text);
        document.body.appendChild(label);
    }");

    expect(implode(' ', $this->overflowingElements($page)))->not->toContain('truncated-text');
});
