<?php

use App\Actions\Integrations\IssueDraft;
use App\Support\Integrations\JiraDataCenter\MarkdownToWikiMarkup;

it('escapes every wiki special in user content', function () {
    expect(MarkdownToWikiMarkup::escape('Fix {code} [x|y] *now* !img! a_b ~s~ ^t^ -u- +v+ \\ #1'))
        ->toBe('Fix \{code\} \[x\|y\] \*now\* \!img\! a\_b \~s\~ \^t\^ \-u\- \+v\+ \\ \#1');
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
    'escaped backslash' => ['\[~jdoe]', "\\\u{200B}\\[\\~jdoe\\]"],
]);

it('never turns backslashes in user text into a line break', function (string $text, string $escaped) {
    expect(MarkdownToWikiMarkup::escape($text))->toBe($escaped)
        ->and(MarkdownToWikiMarkup::escape($text))->not->toContain('\\\\');
})->with([
    'lone' => ['C:\\temp a\\b', 'C:\\temp a\\b'],
    'doubled' => ['a\\\\b', "a\\\u{200B}\\b"],
    'before a special' => ['\\*x*', "\\\u{200B}\\*x\\*"],
    'at the end' => ['end\\', "end\\\u{200B}"],
]);

it('keeps dashes and underscores of bare URLs so Jira still links them', function () {
    expect(MarkdownToWikiMarkup::escape('See https://example.com/my_page-1?a=b_c and my_note-x [x]'))
        ->toBe('See https://example.com/my_page-1?a=b_c and my\_note\-x \[x\]')
        ->and(MarkdownToWikiMarkup::escape('[x|http://evil.test/a_b]'))->toBe('\[x\|http://evil.test/a_b\]');
});
