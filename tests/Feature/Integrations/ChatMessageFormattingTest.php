<?php

use App\Support\Integrations\Messages\LinkShareContent;
use App\Support\Integrations\Messages\MattermostText;
use App\Support\Integrations\Messages\MicrosoftTeamsText;
use App\Support\Integrations\Messages\RetroRecap;
use App\Support\Integrations\Messages\RetroRecapContent;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => Http::preventStrayRequests());

function chatRecap(array $overrides = []): RetroRecap
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

/**
 * @return array<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>
 */
function manyChatActionItems(int $count): array
{
    return array_map(fn (int $number) => [
        'content' => str_repeat("Action {$number} ", 30),
        'assignee' => 'Ada',
        'dueOn' => null,
        'isCompleted' => false,
    ], range(1, $count));
}

it('escapes Adaptive Card Markdown', function (string $text, string $escaped) {
    expect(MicrosoftTeamsText::escape($text))->toBe($escaped);
})->with([
    'emphasis' => ['a*b_c', 'a\*b\_c'],
    'link' => ['[x](http://evil)', '\[x\]\(http://evil\)'],
    'code' => ['`code`', '\`code\`'],
    'heading, quote, strike' => ['# title > quote ~strike', '\# title \> quote \~strike'],
    'backslash' => ['back\slash', 'back\\\\slash'],
    'list markers' => ["- one\n+ two\n3. three", "\\- one\n\\+ two\n3\\. three"],
]);

it('escapes Markdown and mentions for Mattermost', function (string $text, string $escaped) {
    expect(MattermostText::escape($text))->toBe($escaped);
})->with([
    'mentions' => ['@channel and @here', "@\u{200B}channel and @\u{200B}here"],
    'channel link' => ['~town-square', "\\~\u{200B}town-square"],
    'link' => ['[x](http://evil)', '\[x\]\(http://evil\)'],
    'table and autolink' => ['a|b <http://x>', 'a\|b \<http://x\>'],
    'list marker' => ['- item', '\- item'],
]);

it('builds a Teams link card with one open action', function () {
    $message = (new LinkShareContent('Ada invites you to "Sprint *42*" (Platform)', 'Open the retrospective', 'https://skrum.test/retros/1'))->toMicrosoftTeams();
    $card = $message['attachments'][0]['content'];

    expect($message['type'])->toBe('message')
        ->and($message['attachments'][0]['contentType'])->toBe('application/vnd.microsoft.card.adaptive')
        ->and($card['type'])->toBe('AdaptiveCard')
        ->and($card['version'])->toBe('1.4')
        ->and($card['body'])->toBe([[
            'type' => 'TextBlock',
            'text' => 'Ada invites you to "Sprint \*42\*" \(Platform\)',
            'wrap' => true,
        ]])
        ->and($card['actions'])->toBe([['type' => 'Action.OpenUrl', 'title' => 'Open the retrospective', 'url' => 'https://skrum.test/retros/1']]);
});

it('builds a Mattermost link message', function () {
    $text = (new LinkShareContent('Ada invites you to "Sprint *42*" (@all)', 'Open the retrospective', 'https://skrum.test/retros/1'))->toMattermost();

    expect($text)->toBe("Ada invites you to \"Sprint \\*42\\*\" \\(@\u{200B}all\\)\n\n[Open the retrospective](https://skrum.test/retros/1)");
});

it('formats a Teams recap', function () {
    $message = (new RetroRecapContent(chatRecap()))->toMicrosoftTeams();
    $card = $message['attachments'][0]['content'];
    $texts = collect($card['body'])->pluck('text')->all();

    expect($card['body'][0])->toBe(['type' => 'TextBlock', 'text' => 'Results of the retrospective "Sprint 42"', 'wrap' => true, 'size' => 'Large', 'weight' => 'Bolder'])
        ->and(collect($card['body'])->every(fn (array $block) => $block['type'] === 'TextBlock' && $block['wrap'] === true))->toBeTrue()
        ->and($texts)->toContain(
            'Platform · completed on September 28, 2026',
            'Participants \(3\): Ada, Bob, Gus \(guest\)',
            'Cards: 12',
            'ROTI: 4.5/5 \(2 answers\)',
            'Summary',
            'We shipped a lot.',
            'Action items',
            '• Fix the deploy — Ada · Due October 15, 2026',
            'Suggested actions',
            '• Automate the release notes',
            'Top card per column',
            '• Wins — Faster reviews \(votes: 5, grouped cards: 2\)',
        )
        ->and($card['actions'])->toBe([['type' => 'Action.OpenUrl', 'title' => 'Open the results', 'url' => 'https://skrum.test/retros/1']]);
});

it('formats a Mattermost recap', function () {
    $text = (new RetroRecapContent(chatRecap()))->toMattermost();

    expect($text)->toStartWith("#### Results of the retrospective \"Sprint 42\"\nPlatform · completed on September 28, 2026")
        ->and($text)->toContain("Participants \\(3\\): Ada, Bob, Gus \\(guest\\)\nCards: 12\nROTI: 4.5/5 \\(2 answers\\)")
        ->and($text)->toContain("**Summary**\nWe shipped a lot.")
        ->and($text)->toContain("**Action items**\n- Fix the deploy — Ada · Due October 15, 2026")
        ->and($text)->toContain("**Suggested actions**\n- Automate the release notes")
        ->and($text)->toContain("**Top card per column**\n- Wins — Faster reviews \\(votes: 5, grouped cards: 2\\)")
        ->and($text)->toEndWith('[Open the results](https://skrum.test/retros/1)');
});

it('shows only a participant count for anonymous retros', function () {
    $recap = chatRecap(['participantNames' => null]);
    $teams = json_encode((new RetroRecapContent($recap))->toMicrosoftTeams(), JSON_UNESCAPED_UNICODE);
    $mattermost = (new RetroRecapContent($recap))->toMattermost();

    expect($teams)->toContain('Participants: 3')->not->toContain('Bob')
        ->and($mattermost)->toContain('Participants: 3')->not->toContain('Bob');
});

it('escapes recap content in both channels', function () {
    $recap = chatRecap([
        'title' => '[click](http://evil) *now*',
        'actionItems' => [['content' => '@channel - ship ~town-square', 'assignee' => null, 'dueOn' => null, 'isCompleted' => false]],
        'topCards' => [['column' => '# Wins', 'content' => '1. first', 'votes' => 1, 'groupedCount' => 0]],
    ]);
    $texts = collect((new RetroRecapContent($recap))->toMicrosoftTeams()['attachments'][0]['content']['body'])->pluck('text');
    $mattermost = (new RetroRecapContent($recap))->toMattermost();

    expect($texts)->toContain('Results of the retrospective "\[click\]\(http://evil\) \*now\*"', '• @channel - ship \~town-square', '• \# Wins — 1. first \(votes: 1\)')
        ->and($mattermost)->toContain("- @\u{200B}channel - ship \\~\u{200B}town-square")
        ->and($mattermost)->not->toContain('[click](http://evil)')
        ->and($mattermost)->not->toContain('@channel');
});

it('keeps Teams cards within 28 000 bytes, shortening lists first', function () {
    $message = (new RetroRecapContent(chatRecap(['actionItems' => manyChatActionItems(200)])))->toMicrosoftTeams();
    $card = $message['attachments'][0]['content'];
    $texts = collect($card['body'])->pluck('text');

    expect(strlen((string) json_encode($message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)))->toBeLessThanOrEqual(28000)
        ->and(MicrosoftTeamsText::fits($message))->toBeTrue()
        ->and($texts)->toContain('We shipped a lot.', 'Participants \(3\): Ada, Bob, Gus \(guest\)')
        ->and($texts->filter(fn (string $text) => preg_match('/^\\\\\+ \d+ more$/', $text) === 1))->toHaveCount(1)
        ->and($card['actions'][0]['url'])->toBe('https://skrum.test/retros/1');
});

it('keeps Mattermost messages within 16 000 characters, shortening lists first', function () {
    $text = (new RetroRecapContent(chatRecap(['actionItems' => manyChatActionItems(200)])))->toMattermost();

    expect(mb_strlen($text))->toBeLessThanOrEqual(MattermostText::MessageLimit)
        ->and($text)->toContain('We shipped a lot.')
        ->and($text)->toContain('Ada, Bob, Gus \(guest\)')
        ->and($text)->toMatch('/\\\\\+ \d+ more/')
        ->and($text)->toEndWith('[Open the results](https://skrum.test/retros/1)');
});

it('drops participant names last', function () {
    $names = array_map(fn (int $number) => "Participant number {$number}", range(1, 1500));
    $recap = chatRecap(['participantCount' => 1500, 'participantNames' => $names, 'actionItems' => manyChatActionItems(50)]);

    $teams = (new RetroRecapContent($recap))->toMicrosoftTeams();
    $mattermost = (new RetroRecapContent($recap))->toMattermost();

    expect(MicrosoftTeamsText::fits($teams))->toBeTrue()
        ->and(json_encode($teams, JSON_UNESCAPED_UNICODE))->toContain('Participants: 1500')
        ->and(mb_strlen($mattermost))->toBeLessThanOrEqual(MattermostText::MessageLimit)
        ->and($mattermost)->toContain('Participants: 1500')
        ->and($mattermost)->toContain('#### Results of the retrospective');
});

it('measures Teams cards the way they are sent, with default JSON encoding', function () {
    $items = array_map(fn (int $number) => [
        'content' => str_repeat("é•/{$number} ", 30),
        'assignee' => null,
        'dueOn' => null,
        'isCompleted' => false,
    ], range(1, 200));

    $message = (new RetroRecapContent(chatRecap(['actionItems' => $items])))->toMicrosoftTeams();

    expect(strlen((string) json_encode($message)))->toBeLessThanOrEqual(MicrosoftTeamsText::PayloadLimitBytes)
        ->and(MicrosoftTeamsText::fits($message))->toBeTrue();
});

it('treats a Teams message that cannot be encoded as not fitting', function () {
    expect(MicrosoftTeamsText::fits(['text' => "\xB1\x31"]))->toBeFalse();
});

it('escapes list markers after carriage returns and invalid UTF-8 safely', function () {
    expect(MicrosoftTeamsText::escape("a\r- x\r\n+ y"))->toBe("a\n\\- x\n\\+ y")
        ->and(MattermostText::escape("a\r- x"))->toBe("a\n\\- x")
        ->and(MicrosoftTeamsText::escape("bad \xB1 [x](y)"))->toBe('bad ? \[x\]\(y\)')
        ->and(MattermostText::escape("bad \xB1 @here"))->toBe("bad ? @\u{200B}here");
});

it('falls back to the smallest message when even empty lists do not fit', function () {
    $recap = chatRecap(['title' => str_repeat('T', 40000)]);

    $teams = (new RetroRecapContent($recap))->toMicrosoftTeams();
    $mattermost = (new RetroRecapContent($recap))->toMattermost();
    $texts = collect($teams['attachments'][0]['content']['body'])->pluck('text')->implode("\n");

    expect(MicrosoftTeamsText::fits($teams))->toBeFalse()
        ->and($texts)->not->toContain('We shipped a lot.')->not->toContain('Fix the deploy')->toContain('Participants: 3')
        ->and($teams['attachments'][0]['content']['actions'][0]['url'])->toBe('https://skrum.test/retros/1')
        ->and($mattermost)->not->toContain('We shipped a lot.')->not->toContain('Fix the deploy')
        ->and($mattermost)->toEndWith('[Open the results](https://skrum.test/retros/1)');
});
