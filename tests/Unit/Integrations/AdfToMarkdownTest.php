<?php

use App\Support\Integrations\Jira\AdfToMarkdown;

/**
 * @param  array<int, array<string, mixed>>  $content
 * @return array<string, mixed>
 */
function adfDocument(array $content): array
{
    return ['type' => 'doc', 'version' => 1, 'content' => $content];
}

/**
 * @param  array<int, array<string, mixed>>  $marks
 * @return array<string, mixed>
 */
function adfText(string $text, array $marks = []): array
{
    return $marks === [] ? ['type' => 'text', 'text' => $text] : ['type' => 'text', 'text' => $text, 'marks' => $marks];
}

/**
 * @param  array<int, array<string, mixed>>  $content
 * @return array<string, mixed>
 */
function adfParagraph(array $content): array
{
    return ['type' => 'paragraph', 'content' => $content];
}

it('converts marks and links', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([
        adfText('Hello '),
        adfText('bold', [['type' => 'strong']]),
        adfText(' and '),
        adfText('it', [['type' => 'em']]),
        adfText(' '),
        adfText('gone', [['type' => 'strike']]),
        adfText(' '),
        adfText('code()', [['type' => 'code']]),
        adfText(' '),
        adfText('site', [['type' => 'link', 'attrs' => ['href' => 'https://example.com']]]),
    ])]));

    expect($markdown)->toBe('Hello **bold** and *it* ~~gone~~ `code()` [site](https://example.com)');
});

it('converts headings, quotes, rules and code blocks', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [adfText('Goal')]],
        ['type' => 'blockquote', 'content' => [adfParagraph([adfText('Quoted')]), adfParagraph([adfText('Twice')])]],
        ['type' => 'rule'],
        ['type' => 'codeBlock', 'attrs' => ['language' => 'php'], 'content' => [adfText("echo 1;\necho 2;")]],
    ]));

    expect($markdown)->toBe("## Goal\n\n> Quoted\n>\n> Twice\n\n---\n\n```php\necho 1;\necho 2;\n```");
});

it('converts nested lists', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        ['type' => 'bulletList', 'content' => [
            ['type' => 'listItem', 'content' => [
                adfParagraph([adfText('One')]),
                ['type' => 'orderedList', 'attrs' => ['order' => 3], 'content' => [
                    ['type' => 'listItem', 'content' => [adfParagraph([adfText('Three')])]],
                    ['type' => 'listItem', 'content' => [adfParagraph([adfText('Four')])]],
                ]],
            ]],
            ['type' => 'listItem', 'content' => [adfParagraph([adfText('Two')])]],
        ]],
    ]));

    expect($markdown)->toBe("- One\n  3. Three\n  4. Four\n- Two");
});

it('converts mentions, emoji, media and tables', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        adfParagraph([
            adfText('Ping '),
            ['type' => 'mention', 'attrs' => ['id' => 'abc', 'text' => '@Jane']],
            adfText(' '),
            ['type' => 'emoji', 'attrs' => ['shortName' => ':tada:', 'text' => '🎉']],
        ]),
        ['type' => 'mediaSingle', 'content' => [['type' => 'media', 'attrs' => ['id' => 'x', 'type' => 'file']]]],
        ['type' => 'table', 'content' => [
            ['type' => 'tableRow', 'content' => [
                ['type' => 'tableHeader', 'content' => [adfParagraph([adfText('Name')])]],
                ['type' => 'tableHeader', 'content' => [adfParagraph([adfText('Size')])]],
            ]],
            ['type' => 'tableRow', 'content' => [
                ['type' => 'tableCell', 'content' => [adfParagraph([adfText('a|b')])]],
                ['type' => 'tableCell', 'content' => [adfParagraph([adfText('3')])]],
            ]],
        ]],
    ]));

    expect($markdown)->toBe("Ping @Jane 🎉\n\n[attachment]\n\n| Name | Size |\n| --- | --- |\n| a\\|b | 3 |");
});

it('escapes HTML and Markdown characters', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([adfText('<script>alert(1)</script> *not bold* [x]')])]));

    expect($markdown)->toBe('\<script\>alert(1)\</script\> \*not bold\* \[x\]');
});

it('keeps unsafe links as plain text', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([
        adfText('click', [['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]),
    ])]));

    expect($markdown)->toBe('click');
});

it('renders unknown nodes through their children', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([
        ['type' => 'layoutSection', 'content' => [
            ['type' => 'layoutColumn', 'content' => [adfParagraph([adfText('Left')])]],
            ['type' => 'layoutColumn', 'content' => [adfParagraph([adfText('Right')])]],
        ]],
        adfParagraph([['type' => 'status', 'attrs' => ['text' => 'DONE']], adfText(' on '), ['type' => 'date', 'attrs' => ['timestamp' => '1767225600000']]]),
        ['type' => 'expand', 'attrs' => ['title' => 'Details'], 'content' => [adfParagraph([adfText('Hidden')])]],
    ]));

    expect($markdown)->toBe("Left\n\nRight\n\nDONE on 2026-01-01\n\n**Details**\n\nHidden");
});

it('returns null for missing or empty documents', function () {
    expect((new AdfToMarkdown)->convert(null))->toBeNull()
        ->and((new AdfToMarkdown)->convert(adfDocument([])))->toBeNull()
        ->and((new AdfToMarkdown)->convert(adfDocument([adfParagraph([])])))->toBeNull();
});

it('truncates long descriptions', function () {
    $markdown = (new AdfToMarkdown)->convert(adfDocument([adfParagraph([adfText(str_repeat('a', 10050))])]));

    expect(mb_strlen((string) $markdown))->toBe(AdfToMarkdown::MaxLength)
        ->and($markdown)->toEndWith('a…')
        ->and(AdfToMarkdown::truncate('short'))->toBe('short');
});
