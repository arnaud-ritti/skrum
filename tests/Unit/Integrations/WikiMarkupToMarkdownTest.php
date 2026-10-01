<?php

use App\Support\Integrations\JiraDataCenter\WikiMarkupToMarkdown;

it('converts headings and inline formatting', function () {
    expect((new WikiMarkupToMarkdown)->convert("h1. Title\n\nSome *bold*, _italic_ and -gone- text with {{a*b*c}}."))
        ->toBe("# Title\n\nSome **bold**, *italic* and ~~gone~~ text with `a*b*c`.");
});

it('keeps code and noformat blocks verbatim', function () {
    expect((new WikiMarkupToMarkdown)->convert("{code:java}\nint *a* = b_c_d;\n{code}\nAfter"))
        ->toBe("```java\nint *a* = b_c_d;\n```\n\nAfter")
        ->and((new WikiMarkupToMarkdown)->convert("{noformat}\n[x|y] *raw*\n{noformat}"))
        ->toBe("```\n[x|y] *raw*\n```")
        ->and((new WikiMarkupToMarkdown)->convert("{code:title=Foo.java|borderStyle=solid}\nx\n{code}"))
        ->toBe("```\nx\n```");
});

it('converts quotes and lists', function () {
    expect((new WikiMarkupToMarkdown)->convert("{quote}\nfirst\nsecond\n{quote}\nbq. short"))
        ->toBe("> first\n> second\n\n> short")
        ->and((new WikiMarkupToMarkdown)->convert("* one\n** nested\n# first\n## second\n- dash"))
        ->toBe("- one\n  - nested\n1. first\n  1. second\n- dash");
});

it('keeps safe links only', function () {
    expect((new WikiMarkupToMarkdown)->convert('See [the docs|https://example.com/a_b_c], [https://example.com/x] and [bad|javascript:alert(1)].'))
        ->toBe('See [the docs](https://example.com/a_b_c), [https://example.com/x](https://example.com/x) and bad.');
});

it('converts tables and replaces images', function () {
    expect((new WikiMarkupToMarkdown)->convert("||Name||Points||\n|Login|3|\n|[Docs|https://example.com]|5|"))
        ->toBe("| Name | Points |\n| --- | --- |\n| Login | 3 |\n| [Docs](https://example.com) | 5 |")
        ->and((new WikiMarkupToMarkdown)->convert('Screenshot: !screen.png|thumbnail! done. Wow! Great!'))
        ->toBe('Screenshot: [attachment] done. Wow! Great!');
});

it('returns nothing for empty descriptions and truncates long ones', function () {
    $long = (new WikiMarkupToMarkdown)->convert(str_repeat('a', 10001));

    expect((new WikiMarkupToMarkdown)->convert(null))->toBeNull()
        ->and((new WikiMarkupToMarkdown)->convert("  \n "))->toBeNull()
        ->and(mb_strlen((string) $long))->toBe(10000)
        ->and($long)->toEndWith('…');
});

it('converts links before images so exclamation marks in links survive', function () {
    expect((new WikiMarkupToMarkdown)->convert('See [Wow!|https://example.com/a!b], [https://example.com/c!d] and !pic.png!'))
        ->toBe('See [Wow!](https://example.com/a!b), [https://example.com/c!d](https://example.com/c!d) and [attachment]');
});

it('keeps the raw text when the conversion fails', function () {
    $wiki = "Caf\xE9 *notes* for the team";

    expect((new WikiMarkupToMarkdown)->convert($wiki))->toBe(mb_scrub($wiki, 'UTF-8'));
});
