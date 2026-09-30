<?php

use App\Support\Integrations\Messages\RetroRecap;
use App\Support\Integrations\Messages\RetroRecapContent;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function sampleRecap(array $overrides = []): RetroRecap
{
    return new RetroRecap(...[
        'title' => 'Sprint 42',
        'teamName' => 'Platform',
        'completedOn' => 'September 28, 2026',
        'url' => 'https://skrum.test/retros/1',
        'participantCount' => 3,
        'participantNames' => ['Ada', 'Bob', 'Gus (guest)'],
        'cardCount' => 12,
        'rotiAverage' => 4.5,
        'rotiRespondents' => 2,
        'summary' => 'We shipped a lot.',
        'actionItems' => [['content' => 'Fix the deploy', 'assignee' => 'Ada', 'dueOn' => 'October 15, 2026', 'isCompleted' => false]],
        'hiddenActionItems' => 0,
        'suggestedActions' => ['Automate the release notes'],
        'hiddenSuggestedActions' => 0,
        'topCards' => [['column' => 'Wins', 'content' => 'Faster reviews', 'votes' => 5, 'groupedCount' => 2]],
        ...$overrides,
    ]);
}

function slackSectionTexts(array $message): array
{
    return collect($message['blocks'])
        ->where('type', 'section')
        ->map(fn (array $block) => $block['text']['text'])
        ->values()
        ->all();
}

it('formats a Slack recap', function () {
    $message = (new RetroRecapContent(sampleRecap()))->toSlack();
    $json = json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    expect($message['text'])->toBe('Results of the retrospective "Sprint 42"')
        ->and($message['blocks'][0])->toBe(['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => 'Results of the retrospective "Sprint 42"']])
        ->and(collect($message['blocks'])->last())->toBe(['type' => 'actions', 'elements' => [[
            'type' => 'button',
            'text' => ['type' => 'plain_text', 'text' => 'Open the results'],
            'url' => 'https://skrum.test/retros/1',
        ]]])
        ->and(count($message['blocks']))->toBeLessThanOrEqual(50)
        ->and($json)->toContain('Platform · completed on September 28, 2026')
        ->and($json)->toContain('Participants (3): Ada, Bob, Gus (guest)')
        ->and($json)->toContain('Cards: 12')
        ->and($json)->toContain('ROTI: 4.5/5 (2 answers)')
        ->and($json)->toContain('We shipped a lot.')
        ->and($json)->toContain('• Fix the deploy — Ada · Due October 15, 2026')
        ->and($json)->toContain('• Automate the release notes')
        ->and($json)->toContain('• Wins — Faster reviews (votes: 5, grouped cards: 2)');
});

it('formats a Telegram recap', function () {
    $html = (new RetroRecapContent(sampleRecap()))->toTelegram();

    expect($html)->toStartWith('<b>Results of the retrospective &quot;Sprint 42&quot;</b>')
        ->and($html)->toContain('Participants (3): Ada, Bob, Gus (guest)')
        ->and($html)->toContain("<b>Action items</b>\n• Fix the deploy — Ada · Due October 15, 2026")
        ->and($html)->toContain("<b>Top card per column</b>\n• Wins — Faster reviews (votes: 5, grouped cards: 2)")
        ->and($html)->toEndWith('<a href="https://skrum.test/retros/1">Open the results</a>');
});

it('escapes user content in Slack', function () {
    $recap = sampleRecap([
        'title' => '<!here> retro',
        'summary' => 'Ping <!channel> & <@U123>',
        'topCards' => [['column' => 'A&B', 'content' => 'See <http://evil.test|this>', 'votes' => 1, 'groupedCount' => 0]],
    ]);

    $json = json_encode((new RetroRecapContent($recap))->toSlack(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    expect($json)->not->toContain('<!channel>')
        ->not->toContain('<!here>')
        ->not->toContain('<@U123>')
        ->not->toContain('<http://evil.test|this>')
        ->toContain('Ping &lt;!channel&gt; &amp; &lt;@U123&gt;')
        ->toContain('A&amp;B — See &lt;http://evil.test|this&gt;');
});

it('escapes user content in Telegram HTML', function () {
    $recap = sampleRecap([
        'summary' => '<b>bold</b> & <a href="https://evil.test">x</a>',
        'actionItems' => [['content' => '<i>Fix</i>', 'assignee' => "O'Brien", 'dueOn' => null, 'isCompleted' => true]],
    ]);

    $html = (new RetroRecapContent($recap))->toTelegram();

    expect($html)->toContain('&lt;b&gt;bold&lt;/b&gt; &amp; &lt;a href=&quot;https://evil.test&quot;&gt;x&lt;/a&gt;')
        ->toContain('• ✓ &lt;i&gt;Fix&lt;/i&gt; — O&#039;Brien')
        ->not->toContain('href="https://evil.test"');
});

it('keeps Slack sections within 3000 characters', function () {
    $recap = sampleRecap([
        'summary' => str_repeat('s', 5000),
        'participantNames' => array_map(fn (int $index) => "Participant number {$index}", range(1, 200)),
        'actionItems' => array_fill(0, 10, ['content' => str_repeat('x', 290), 'assignee' => 'Ada', 'dueOn' => null, 'isCompleted' => false]),
        'hiddenActionItems' => 3,
        'topCards' => array_fill(0, 20, ['column' => 'Column', 'content' => str_repeat('y', 300), 'votes' => 2, 'groupedCount' => 0]),
    ]);

    $message = (new RetroRecapContent($recap))->toSlack();
    $actionItems = collect(slackSectionTexts($message))->first(fn (string $text) => str_starts_with($text, '*Action items*'));

    foreach (slackSectionTexts($message) as $text) {
        expect(mb_strlen($text))->toBeLessThanOrEqual(3000);
    }

    expect(mb_strlen($message['blocks'][0]['text']['text']))->toBeLessThanOrEqual(150)
        ->and($actionItems)->toMatch('/\+ \d+ more$/')
        ->and(substr_count($actionItems, '• '))->toBeLessThan(10);
});

it('keeps Telegram messages within 4096 characters', function () {
    $recap = sampleRecap([
        'summary' => 'Short summary.',
        'actionItems' => array_fill(0, 10, ['content' => str_repeat('x', 290), 'assignee' => 'Ada', 'dueOn' => null, 'isCompleted' => false]),
        'topCards' => array_fill(0, 8, ['column' => 'Column', 'content' => str_repeat('y', 300), 'votes' => 2, 'groupedCount' => 0]),
    ]);

    $html = (new RetroRecapContent($recap))->toTelegram();

    expect(mb_strlen($html))->toBeLessThanOrEqual(4096)
        ->and($html)->toContain('Short summary.')
        ->and($html)->toContain('Participants (3): Ada, Bob, Gus (guest)')
        ->and($html)->toMatch('/\+ \d+ more/');
});

it('omits empty sections', function () {
    $recap = sampleRecap([
        'rotiAverage' => null,
        'rotiRespondents' => 0,
        'summary' => null,
        'actionItems' => [],
        'suggestedActions' => [],
        'topCards' => [],
        'participantNames' => null,
    ]);

    $slack = json_encode((new RetroRecapContent($recap))->toSlack(), JSON_UNESCAPED_UNICODE);
    $telegram = (new RetroRecapContent($recap))->toTelegram();

    foreach ([$slack, $telegram] as $message) {
        expect($message)->toContain('Participants: 3')
            ->not->toContain('ROTI')
            ->not->toContain('Summary')
            ->not->toContain('Action items')
            ->not->toContain('Suggested actions')
            ->not->toContain('Top card per column');
    }
});
