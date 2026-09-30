<?php

use App\Actions\Poker\RenderTaskMarkdown;

function renderTaskMarkdown(?string $markdown): string
{
    return app(RenderTaskMarkdown::class)->handle($markdown);
}

it('renders nothing for an empty description', function () {
    expect(renderTaskMarkdown(null))->toBe('')
        ->and(renderTaskMarkdown('   '))->toBe('');
});

it('escapes raw html', function () {
    $html = renderTaskMarkdown("Intro\n\n<script>alert(1)</script>\n\n<b onclick=\"x()\">bold</b>");

    expect($html)->not->toContain('<script')
        ->and($html)->not->toContain('<b onclick')
        ->and($html)->toContain('&lt;script&gt;');
});

it('drops javascript links', function () {
    $html = renderTaskMarkdown('[click](javascript:alert(1)) and <javascript:alert(2)>');

    expect($html)->not->toContain('javascript:alert(1)"')
        ->and($html)->not->toContain('href="javascript:')
        ->and($html)->toContain('click');
});

it('renders images as links', function () {
    $html = renderTaskMarkdown('![diagram](https://example.com/a.png) ![bad](javascript:alert(1)) ![inline](data:image/png;base64,AAAA)');

    expect($html)->not->toContain('<img')
        ->and($html)->toContain('<a href="https://example.com/a.png" rel="nofollow noopener noreferrer" target="_blank">diagram</a>')
        ->and($html)->toContain('bad')
        ->and($html)->not->toContain('href="javascript:')
        ->and($html)->not->toContain('href="data:');
});

it('marks external links', function () {
    $html = renderTaskMarkdown('See [the docs](https://docs.example.com/page).');

    expect($html)->toContain('href="https://docs.example.com/page"')
        ->and($html)->toContain('rel="nofollow noopener noreferrer"')
        ->and($html)->toContain('target="_blank"');
});

it('escapes the url used as link text when the alt text is empty', function () {
    $html = renderTaskMarkdown('![](https://example.com/a.png?x=1&y=2)');

    expect($html)->toContain('>https://example.com/a.png?x=1&amp;y=2</a>')
        ->and($html)->not->toContain('>https://example.com/a.png?x=1&y=2</a>');
});
