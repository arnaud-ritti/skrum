<?php

use App\Support\Integrations\GitHub\EstimateBlock;
use App\Support\Integrations\GitHub\GitHubMarkdown;

it('neutralizes mentions and issue references', function () {
    expect(GitHubMarkdown::escape('Ping @core about #12 and acme/api#3, not #tag'))
        ->toBe("Ping @\u{200B}core about \\#\u{200B}12 and acme/api\\#\u{200B}3, not \\#tag");
});

it('escapes links, images and HTML', function () {
    expect(GitHubMarkdown::escape('[a](b) ![c](d) <img>'))->toBe('\[a\]\(b\) !\[c\]\(d\) \<img\>');
});

it('reads back what it escaped', function (string $text) {
    expect(GitHubMarkdown::unescape(GitHubMarkdown::escape($text)))->toBe($text)
        ->and(EstimateBlock::value(EstimateBlock::render($text)))->toBe($text);
})->with(['#1', '@me', '[5]', 'XL & up', '- 5', '1. first', '+ more', '===']);

it('keeps line-start Markdown from becoming lists, headings or code', function () {
    expect(GitHubMarkdown::escape("1. foo\n- bar\n+ baz\n===\n    indented"))
        ->toBe("1\\. foo\n\\- bar\n\\+ baz\n\\===\nindented");
});
