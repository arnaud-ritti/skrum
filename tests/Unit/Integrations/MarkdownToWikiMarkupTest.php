<?php

use App\Actions\Integrations\IssueDraft;
use App\Support\Integrations\JiraDataCenter\MarkdownToWikiMarkup;

it('escapes every wiki special in user content', function () {
    expect(MarkdownToWikiMarkup::escape('Fix {code} [x|y] *now* !img! a_b ~s~ ^t^ -u- +v+ \\ #1'))
        ->toBe('Fix \{code\} \[x\|y\] \*now\* \!img\! a\_b \~s\~ \^t\^ \-u\- \+v\+ \\\\ \#1');
});

it('builds the issue description as wiki paragraphs with the link back', function () {
    $draft = new IssueDraft('Buy milk', ['Buy milk', 'Call *Bob*'], 'From the retrospective "Sprint 1" on October 1, 2026:', 'https://skrum.test/w/acme/action-items?item=1', null);

    expect(MarkdownToWikiMarkup::draft($draft))->toBe(
        "Buy milk\n\nCall \\*Bob\\*\n\nFrom the retrospective \"Sprint 1\" on October 1, 2026: [https://skrum.test/w/acme/action-items?item=1]"
    );
});

it('keeps links, macros and mentions in user text from becoming wiki markup', function (string $text, string $escaped) {
    $draft = new IssueDraft('Title', [$text], 'From the retrospective "[~admin] {html}" on October 1, 2026:', 'https://skrum.test/w/acme/action-items?item=1', null);

    expect(MarkdownToWikiMarkup::draft($draft))->toBe(
        "{$escaped}\n\nFrom the retrospective \"\\[\\~admin\\] \\{html\\}\" on October 1, 2026: [https://skrum.test/w/acme/action-items?item=1]"
    );
})->with([
    'link' => ['[click|https://evil.test]', '\[click\|https://evil.test\]'],
    'html macro' => ['{html}<script>x</script>{html}', '\{html\}<script>x</script>\{html\}'],
    'mention' => ['ping [~jdoe]', 'ping \[\~jdoe\]'],
    'image' => ['!https://evil.test/a.png!', '\!https://evil.test/a.png\!'],
    'escaped backslash' => ['\[~jdoe]', '\\\\\[\~jdoe\]'],
]);
