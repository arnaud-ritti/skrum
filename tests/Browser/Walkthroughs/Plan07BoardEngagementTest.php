<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     retro: Retro,
 *     columns: array<int, Column>,
 *     alice: User,
 *     bob: User,
 *     carol: User,
 *     aliceParticipant: Participant,
 *     bobParticipant: Participant,
 *     carolParticipant: Participant
 * }
 */
function plan07Board(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->create(['title' => 'Sprint 12', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    [$carol, $carolParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);
    $carol->update(['name' => 'Carol Reyes', 'locale' => 'en']);

    return [
        'retro' => $retro->fresh(),
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ];
}

function plan07Card(Retro $retro, Column $column, Participant $author, ?string $content, int $position = 0, ?string $gifId = null): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'gif_id' => $gifId,
        'position' => $position,
    ]);
}

function plan07Reaction(Card $card, Participant $participant, string $emoji): CardReaction
{
    return CardReaction::factory()->create([
        'retro_id' => $card->retro_id,
        'card_id' => $card->id,
        'participant_id' => $participant->id,
        'emoji' => $emoji,
    ]);
}

function plan07Comment(Card $card, Participant $participant, string $content): CardComment
{
    return CardComment::factory()->create([
        'retro_id' => $card->retro_id,
        'card_id' => $card->id,
        'participant_id' => $participant->id,
        'content' => $content,
    ]);
}

function plan07Chip(Card $card, string $emoji, int $count): string
{
    $noun = $count === 1 ? 'reaction' : 'reactions';

    return "#card-{$card->id} button[aria-label=\"{$emoji}, {$count} {$noun}\"]";
}

function plan07IsNativelyDisabled(string $selector): string
{
    return 'document.querySelector('.json_encode($selector).').disabled';
}

function plan07OpenSettings(mixed $page): mixed
{
    return $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings');
}

function plan07SaveSettings(mixed $page): mixed
{
    return $page->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent('[role="menu"]');
}

function plan07ShowsVoteTotal(Card $card): string
{
    return "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";
}

function plan07CursorIsOver(Card $card): string
{
    return sprintf(
        '(async () => { const tip = () => document.querySelector(".lc-cursor")?.getBoundingClientRect() ?? null; const before = tip(); await new Promise((resolve) => setTimeout(resolve, 200)); const after = tip(); const card = document.getElementById(%s); if (before === null || after === null || card === null) { return false; } const box = card.getBoundingClientRect(); return before.left === after.left && before.top === after.top && after.left >= box.left && after.left <= box.right && after.top >= box.top && after.top <= box.bottom; })()',
        json_encode("card-{$card->id}"),
    );
}

/**
 * @return array{
 *     id: string,
 *     images: array<string, array<string, string>>
 * }
 */
function plan07GiphyItem(string $id): array
{
    return [
        'id' => $id,
        'images' => [
            'fixed_width' => ['url' => "https://media.giphy.com/{$id}/200w.gif", 'webp' => "https://media.giphy.com/{$id}/200w.webp", 'width' => '200', 'height' => '150'],
            'original' => ['url' => "https://media.giphy.com/{$id}/giphy.gif", 'webp' => "https://media.giphy.com/{$id}/giphy.webp", 'width' => '480', 'height' => '360'],
        ],
    ];
}

function plan07FakeUpstreams(): void
{
    Storage::fake();
    config(['services.emoji_data.version' => '17.0.0']);

    $pixel = base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    $json = ['Content-Type' => 'application/json; charset=utf-8'];
    $emojis = (string) json_encode([
        ['emoji' => '🚀', 'hexcode' => '1F680', 'group' => 0, 'subgroup' => 0, 'order' => 1, 'version' => 1, 'label' => 'rocket', 'tags' => ['launch', 'space']],
        ['emoji' => '🦄', 'hexcode' => '1F984', 'group' => 0, 'subgroup' => 0, 'order' => 2, 'version' => 1, 'label' => 'unicorn', 'tags' => ['face']],
    ], JSON_UNESCAPED_UNICODE);
    $messages = (string) json_encode([
        'groups' => [['key' => 'smileys-emotion', 'message' => 'smileys & emotion', 'order' => 0]],
        'subgroups' => [['key' => 'face-smiling', 'message' => 'face smiling', 'order' => 0]],
        'skinTones' => [
            ['key' => 'light', 'message' => 'light skin tone'],
            ['key' => 'medium-light', 'message' => 'medium-light skin tone'],
            ['key' => 'medium', 'message' => 'medium skin tone'],
            ['key' => 'medium-dark', 'message' => 'medium-dark skin tone'],
            ['key' => 'dark', 'message' => 'dark skin tone'],
        ],
    ]);

    Http::fake([
        'api.giphy.com/v1/gifs/trending*' => fn () => Http::response(['data' => [plan07GiphyItem('hot1'), plan07GiphyItem('hot2')]]),
        'api.giphy.com/v1/gifs/search*' => fn () => Http::response(['data' => [plan07GiphyItem('party1')]]),
        'api.giphy.com/v1/gifs/party1*' => fn () => Http::response(['data' => plan07GiphyItem('party1')]),
        'media.giphy.com/*' => fn () => Http::response($pixel, 200, ['Content-Type' => 'image/gif']),
        'cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json' => fn () => Http::response($emojis, 200, $json),
        'cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/messages.json' => fn () => Http::response($messages, 200, $json),
        '*' => fn () => Http::response('Unexpected request', 500),
    ]);
}

function plan07EnableGifs(): void
{
    config(['services.gifs' => ['provider' => 'giphy', 'key' => 'plan07-gif-key', 'rating' => 'pg']]);
}

function plan07OpenComposer(mixed $page, Column $column): mixed
{
    return $page->click("[data-test=\"retro-column-{$column->id}\"] [data-slot=\"retro-column-add\"]")
        ->assertVisible("[data-test=\"retro-column-{$column->id}\"] [data-slot=\"retro-card-composer\"] textarea");
}

function plan07ImageLoaded(string $selector): string
{
    return sprintf(
        '(() => { const image = document.querySelector(%s); return image !== null && image.complete && image.naturalWidth > 0; })()',
        json_encode($selector),
    );
}

function plan07Requested(string $path): string
{
    return sprintf(
        'performance.getEntriesByType("resource").some((entry) => new URL(entry.name).origin === location.origin && new URL(entry.name).pathname === %s)',
        json_encode($path),
    );
}

function plan07RecordResourcesPastTheBoardLoad(): string
{
    return '() => { performance.setResourceTimingBufferSize(10000); return true; }';
}

function plan07ThirdPartyRequests(): string
{
    return '[...performance.getEntriesByType("resource").map((entry) => entry.name), ...[...document.querySelectorAll("img, source")].map((element) => element.currentSrc || element.src)].filter((url) => /giphy\.com|tenor\.com|tenor\.googleapis\.com|jsdelivr\.net/.test(url)).length';
}

function plan07ForeignImages(): string
{
    return '[...document.querySelectorAll("img, source")].filter((element) => new URL(element.currentSrc || element.src, location.href).origin !== location.origin).length';
}

it('[P07-03a] toggles card reactions with any emoji, counts them live and names the reactors in the tooltip', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $aliceParticipant, '👍');
    plan07Reaction($card, $carolParticipant, '🦄');
    $tooltip = '[data-slot="tooltip-content"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertAriaAttribute(plan07Chip($card, '👍', 1), 'pressed', 'true');

    $bobPage->assertAriaAttribute(plan07Chip($card, '👍', 1), 'pressed', 'false')
        ->assertAriaAttribute(plan07Chip($card, '🦄', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '👍', 1))
        ->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true');

    $alicePage->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true');

    $bobPage->hover('header >> h1')
        ->hover(plan07Chip($card, '👍', 2))
        ->assertSeeIn($tooltip, 'Alice Martin')
        ->assertSeeIn($tooltip, 'Bob Stone');

    $bobPage->hover('header >> h1')
        ->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
        ->assertVisible('[role="menuitem"]:has-text("🎉")')
        ->click('[role="menuitem"]:has-text("🎉")')
        ->assertNotPresent('[role="menu"]')
        ->assertAriaAttribute(plan07Chip($card, '🎉', 1), 'pressed', 'true');

    $alicePage->assertAriaAttribute(plan07Chip($card, '🎉', 1), 'pressed', 'false');

    $bobPage->click(plan07Chip($card, '🦄', 1))
        ->assertAriaAttribute(plan07Chip($card, '🦄', 2), 'pressed', 'true');

    $alicePage->assertPresent(plan07Chip($card, '🦄', 2));

    $bobPage->click(plan07Chip($card, '🦄', 2))
        ->assertAriaAttribute(plan07Chip($card, '🦄', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '🎉', 1))
        ->assertNotPresent("#card-{$card->id} button[aria-label^=\"🎉\"]");

    $alicePage->assertPresent(plan07Chip($card, '🦄', 1))
        ->assertNotPresent("#card-{$card->id} button[aria-label^=\"🎉\"]")
        ->assertPresent(plan07Chip($card, '👍', 2));

    expect(CardReaction::query()->where('card_id', $card->id)->count())->toBe(3)
        ->and(CardReaction::query()->where('participant_id', $bobParticipant->id)->pluck('emoji')->all())->toBe(['👍']);
});

it('[P07-07a] turns reactions and live cursors off and on for everyone from the settings', function () {
    config(['services.gifs' => ['provider' => null, 'key' => null, 'rating' => 'pg']]);

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $carolParticipant, '👍');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent(plan07Chip($card, '👍', 1));
    }

    $bobPage->assertNotPresent('[aria-label="Facilitator menu"]');

    plan07OpenSettings($alicePage)
        ->assertSee('Show reactions')
        ->assertSee('Show live cursors')
        ->assertSee('Hide vote counts')
        ->assertSee('Lock board')
        ->assertSee('Presentation mode')
        ->assertNotPresent('#retro-gifs')
        ->assertAriaAttribute('#retro-reactions', 'checked', 'true')
        ->assertAriaAttribute('#retro-cursors', 'checked', 'true')
        ->click('#retro-reactions')
        ->click('#retro-cursors')
        ->assertAriaAttribute('#retro-reactions', 'checked', 'false')
        ->assertAriaAttribute('#retro-cursors', 'checked', 'false');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent(plan07Chip($card, '👍', 1))
            ->assertNotPresent("#card-{$card->id} [aria-label=\"Add a reaction\"]");
    }

    expect($retro->fresh()->reactions_enabled)->toBeFalse()
        ->and($retro->fresh()->cursors_enabled)->toBeFalse()
        ->and(CardReaction::query()->where('card_id', $card->id)->count())->toBe(1);

    plan07OpenSettings($alicePage)
        ->assertAriaAttribute('#retro-reactions', 'checked', 'false')
        ->click('#retro-reactions')
        ->click('#retro-cursors');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent(plan07Chip($card, '👍', 1));
    }
});

it('[P07-04a] writes, answers, edits and deletes comments in a thread that every participant sees live', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI');
    $thread = "#card-{$card->id}";
    $toggle = "{$thread} button[aria-label^=\"Comments (\"]";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $replyBox = "{$thread} textarea[aria-label=\"Write a reply…\"]";
    $editBox = "{$thread} textarea[aria-label=\"Edit comment\"]";
    $edit = "{$thread} button[aria-label=\"Edit comment\"]";
    $delete = "{$thread} button[aria-label=\"Delete comment\"]";
    $replies = "{$thread} button:has-text(\"1 reply\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]");

    $bobPage->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertSeeIn($thread, 'Carol Reyes')
        ->assertNotPresent($edit)
        ->assertNotPresent($delete)
        ->click("{$thread} button:has-text(\"Reply\")")
        ->assertVisible($replyBox)
        ->fill($replyBox, 'The deploy one.')
        ->keys($replyBox, 'Enter')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]");

    $carolPage->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]")
        ->assertDontSeeIn($thread, 'The deploy one.')
        ->click($replies)
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} p:has-text(\"Bob Stone\")")
        ->assertCount($edit, 1)
        ->click($edit)
        ->assertValue($editBox, 'Which pipeline is slow?')
        ->fill($editBox, 'Which pipeline is the slow one?')
        ->keys($editBox, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is the slow one?');

    $bobPage->assertSeeIn($thread, 'Which pipeline is the slow one?')
        ->assertCount($edit, 1)
        ->assertCount($delete, 1);

    $parent = CardComment::query()->whereNull('parent_comment_id')->sole();

    expect($parent->content)->toBe('Which pipeline is the slow one?')
        ->and($parent->replies()->count())->toBe(1);

    $carolPage->click($delete)
        ->assertSeeIn($thread, 'Comment deleted')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]");

    $bobPage->assertSeeIn($thread, 'Comment deleted')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertDontSeeIn($thread, 'Which pipeline is the slow one?');

    expect($parent->fresh()->deleted_at)->not->toBeNull();

    $alicePage->click($toggle)
        ->assertSeeIn($thread, 'Comment deleted')
        ->click($replies)
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertNotPresent($edit)
        ->assertCount($delete, 1)
        ->click($delete);

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertPresent("{$thread} button[aria-label=\"Comments (0)\"]")
            ->assertDontSeeIn($thread, 'Comment deleted')
            ->assertDontSeeIn($thread, 'The deploy one.');
    }

    expect(CardComment::query()->count())->toBe(0);
});

it('[P07-04b] notifies only the card author and the thread, and keeps the unread dot across a reload until the thread is read', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI');
    $thread = "#card-{$card->id}";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $replyBox = "{$thread} textarea[aria-label=\"Write a reply…\"]";
    $dot = "{$thread} [aria-label=\"Unread comments\"]";
    $isMarkedRead = "Object.keys(JSON.parse(localStorage.getItem('skrum.readComments.{$retro->id}') ?? '{}')).includes('{$card->id}')";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent($dot);

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is slow?');

    $bobPage->assertSee('New comment on your card')
        ->assertSee('Carol Reyes: Which pipeline is slow?')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertPresent($dot);

    $alicePage->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertDontSee('New comment on your card')
        ->assertNotPresent($dot);

    $carolPage->assertDontSee('New comment on your card')
        ->assertNotPresent($dot);

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertPresent($dot)
        ->assertDontSee('New comment on your card')
        ->assertScript($isMarkedRead, false)
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertNotPresent($dot)
        ->assertScript($isMarkedRead, true);

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertNotPresent($dot)
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->click("{$thread} button:has-text(\"Reply\")")
        ->assertVisible($replyBox)
        ->fill($replyBox, 'The deploy one.')
        ->keys($replyBox, 'Enter')
        ->assertSeeIn($thread, 'The deploy one.');

    $carolPage->assertSee('New reply in a thread you follow')
        ->assertSee('Bob Stone: The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]");

    $alicePage->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]")
        ->assertDontSee('New reply in a thread you follow')
        ->assertNotPresent($dot);
});

it('[P07-06a] shows no name on reaction chips, comments or notification toasts on an anonymous retro', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board(RetroPhase::Grouping, ['is_anonymous' => true]);
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Too many meetings');
    plan07Reaction($card, $aliceParticipant, '👍');
    $thread = "#card-{$card->id}";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $tooltip = '[data-slot="tooltip-content"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $carolPage->assertSeeIn($thread, 'Too many meetings')
        ->assertDontSeeIn($thread, 'Bob Stone')
        ->hover(plan07Chip($card, '👍', 1))
        ->assertNotPresent($tooltip)
        ->click(plan07Chip($card, '👍', 1))
        ->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true')
        ->hover('header >> h1')
        ->hover(plan07Chip($card, '👍', 2))
        ->assertNotPresent($tooltip);

    $bobPage->assertPresent(plan07Chip($card, '👍', 2))
        ->hover(plan07Chip($card, '👍', 2))
        ->assertNotPresent($tooltip);

    foreach ([$carolPage, $bobPage] as $page) {
        $reactions = collect(collect($this->snapshotOf($page, "/retros/{$retro->id}/snapshot")['cards'])->firstWhere('id', $card->id)['reactions']);

        expect($reactions->sum('count'))->toBe(2)
            ->and($reactions->pluck('names')->flatten()->all())->toBeEmpty();
    }

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Is this still true?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Is this still true?')
        ->assertSeeIn($thread, 'Carol Reyes');

    $bobPage->assertSee('New comment on your card')
        ->assertSee('Is this still true?')
        ->assertDontSee('Carol Reyes: Is this still true?')
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Is this still true?')
        ->assertSeeIn($thread, 'Anonymous')
        ->assertDontSeeIn($thread, 'Carol Reyes');
});

it('[P07-10] shows vote totals live during Voting, hides them with "Hide vote counts" and shows them again in Discussing', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Voting);
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $carolParticipant->id]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]");
    }

    $bobPage->click("#card-{$card->id} [aria-label=\"Add a vote\"]")
        ->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Carol Reyes');

    $alicePage->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Bob Stone');

    plan07OpenSettings($alicePage)
        ->click('#retro-hide-vote-counts')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertScript(plan07ShowsVoteTotal($card), false);
    }

    $bobPage->assertSee('Votes left: 4')
        ->click("#card-{$card->id} [aria-label=\"Remove a vote\"]")
        ->assertSee('Votes left: 5')
        ->assertScript(plan07ShowsVoteTotal($card), false);

    $alicePage->assertSee('1 of 15 votes cast')
        ->assertScript(plan07ShowsVoteTotal($card), false)
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]");
    }

    expect($retro->fresh()->hide_vote_counts)->toBeTrue()
        ->and($retro->votes()->count())->toBe(1);
});

it('[P07-08a] closes the board for editing in every phase while the facilitator still moves the phase and the timer', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Writing);
    $mine = plan07Card($retro, $columns[0], $bobParticipant, 'Pairing works well', 0);
    $slow = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 1);
    plan07Reaction($slow, $carolParticipant, '👍');
    plan07Comment($slow, $carolParticipant, 'Which pipeline is slow?');
    $current = '[aria-current="step"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertCount('[data-slot="retro-column-add"]', 3)
        ->assertPresent("#card-{$mine->id} [aria-label=\"Edit card\"]")
        ->assertAttribute("@retro-card-handle-{$mine->id}", 'aria-disabled', 'false')
        ->assertDontSee('Board closed for editing');

    plan07OpenSettings($alicePage)
        ->click('#retro-locked')
        ->assertAriaAttribute('#retro-locked', 'checked', 'true');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSee('Board closed for editing');
    }

    $bobPage->assertNotPresent('[data-slot="retro-column-add"]')
        ->assertNotPresent("#card-{$mine->id} [aria-label=\"Edit card\"]")
        ->assertNotPresent("#card-{$mine->id} [aria-label=\"Delete card\"]")
        ->assertAttribute("@retro-card-handle-{$mine->id}", 'aria-disabled', 'true');

    $alicePage->press('Next')->assertSeeIn($current, 'Grouping');

    $bobPage->assertSeeIn($current, 'Grouping')
        ->assertSee('Board closed for editing')
        ->assertAttribute("@retro-card-handle-{$slow->id}", 'aria-disabled', 'true')
        ->assertScript(plan07IsNativelyDisabled(plan07Chip($slow, '👍', 1)), true)
        ->assertNotPresent("#card-{$slow->id} [aria-label=\"Add a reaction\"]")
        ->assertAriaAttribute("#card-{$slow->id} button[aria-label=\"Comments (1)\"]", 'expanded', 'false')
        ->script("() => document.querySelector('#card-{$slow->id} button[aria-label=\"Comments (1)\"]').click()");

    $bobPage->assertAriaAttribute("#card-{$slow->id} button[aria-label=\"Comments (1)\"]", 'expanded', 'true')
        ->assertSeeIn("#card-{$slow->id}", 'Which pipeline is slow?')
        ->assertNotPresent("#card-{$slow->id} textarea")
        ->assertNotPresent("#card-{$slow->id} button[aria-label=\"Delete comment\"]");

    $alicePage->press('Next')->assertSeeIn($current, 'Voting');

    $bobPage->assertSeeIn($current, 'Voting')
        ->assertDisabled("#card-{$slow->id} [aria-label=\"Add a vote\"]")
        ->assertDisabled("#card-{$mine->id} [aria-label=\"Add a vote\"]");

    $alicePage->press('Next')->assertSeeIn($current, 'Discussing');

    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertDisabled('[aria-label="Add an action item…"]')
        ->assertNotPresent('[role="timer"]');

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertNotPresent('[role="menu"]');

    $bobPage->assertPresent('[role="timer"]');

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Discussing)
        ->and($retro->fresh()->timer_ends_at)->not->toBeNull()
        ->and($retro->cards()->count())->toBe(2)
        ->and($retro->votes()->count())->toBe(0)
        ->and(CardReaction::query()->where('card_id', $slow->id)->count())->toBe(1)
        ->and(CardComment::query()->where('card_id', $slow->id)->count())->toBe(1);

    plan07OpenSettings($alicePage)
        ->assertAriaAttribute('#retro-locked', 'checked', 'true')
        ->click('#retro-locked');
    plan07SaveSettings($alicePage);

    $bobPage->assertDontSee('Board closed for editing')
        ->assertEnabled('[aria-label="Add an action item…"]')
        ->click('[data-test="retro-topics"] li:has-text("Slow CI")')
        ->assertEnabled(plan07Chip($slow, '👍', 1));

    expect($retro->fresh()->is_locked)->toBeFalse();
});

it('[P07-08b] answers an edit from a page that missed the lock with the "closed for editing" toast and resyncs the board', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $carolParticipant, '👍');

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled(plan07Chip($card, '👍', 1))
        ->assertDontSee('Board closed for editing');

    $this->awaitResync($page);

    $retro->forceFill(['is_locked' => true])->save();

    $page->click(plan07Chip($card, '👍', 1))
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertScript(plan07IsNativelyDisabled(plan07Chip($card, '👍', 1)), true)
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Add a reaction\"]");

    expect(CardReaction::query()->where('card_id', $card->id)->count())->toBe(1);
});

it('[P07-09] shows the highlighted card to everyone on the stage under the focus banner, lets a participant browse away and brings them back', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Discussing);
    $slow = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI', 0);
    $flaky = plan07Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $carolParticipant->id]);
    plan07Reaction($slow, $carolParticipant, '👍');
    plan07Comment($slow, $carolParticipant, 'Which pipeline is slow?');
    $banner = '[data-slot="retro-topic-follow"]';
    $focus = '[data-slot="retro-topic-focus"]';
    $presentedChip = "{$focus} button[aria-label=\"👍, 1 reaction\"]";
    $tooltip = '[data-slot="tooltip-content"]';
    $discuss = fn (Card $card): string => "#card-{$card->id} button:has-text(\"Discuss\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    plan07OpenSettings($alicePage)
        ->click('#retro-presentation')
        ->assertAriaAttribute('#retro-presentation', 'checked', 'true');
    plan07SaveSettings($alicePage);

    $bobPage->assertNotPresent($banner);

    $alicePage->click($discuss($slow));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn($banner, 'Alice Martin put this topic in focus — everyone is looking here')
            ->assertNotPresent('[role="dialog"]')
            ->assertSeeIn($focus, 'Slow CI')
            ->assertAttribute("{$focus} [data-slot=\"retro-card-author\"]", 'title', 'Bob Stone')
            ->assertSeeIn($focus, '2 votes')
            ->assertPresent($presentedChip)
            ->assertPresent("{$focus} button[aria-label=\"Comments (1)\"]");
    }

    $bobPage->hover($presentedChip)
        ->assertSeeIn($tooltip, 'Carol Reyes')
        ->click('[data-test="retro-topics"] li:has-text("Flaky tests")')
        ->assertSeeIn($banner, 'Everyone is looking at another topic.')
        ->assertSeeIn($focus, 'Flaky tests')
        ->press('Back to the topic')
        ->assertSeeIn($focus, 'Slow CI');

    expect($retro->fresh()->highlighted_card_id)->toBe($slow->id);

    $alicePage->click('[data-test="retro-topics"] li:has-text("Flaky tests")');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn($focus, 'Flaky tests')
            ->assertSeeIn($banner, 'Alice Martin put this topic in focus — everyone is looking here');
    }

    expect($retro->fresh()->highlighted_card_id)->toBe($flaky->id)
        ->and($retro->fresh()->presentation_mode)->toBeTrue();
});

it('[P07-01a] shows a named cursor over the same card on another page and keeps it there when that page scrolls the board', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board();
    $first = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $third = plan07Card($retro, $columns[2], $aliceParticipant, 'Keep the demo on Fridays');
    $board = 'document.querySelector("[data-slot=\"retro-columns\"]")';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->resize(800, 700)
            ->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertScript("{$board}.scrollWidth > {$board}.clientWidth", true);
    }

    $carolPage->assertNotPresent('.lc-cursor')
        ->assertScript("{$board}.scrollLeft", 0);

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$third->id}");

    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone')
        ->assertScript(plan07CursorIsOver($third), true);

    $bobPage->assertNotPresent('.lc-cursor');

    $carolPage->script("() => { const board = {$board}; board.scrollLeft = board.scrollWidth; return board.scrollLeft; }");
    $carolPage->assertScript("{$board}.scrollLeft > 0", true);

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$third->id}");

    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone')
        ->assertScript(plan07CursorIsOver($third), true);

    $carolPage->hover("#card-{$third->id}")->hover("#card-{$first->id}");

    $bobPage->assertSeeIn('.lc-overlay', 'Carol Reyes')
        ->assertScript(plan07CursorIsOver($first), true);
});

it('[P07-01b] removes a cursor when its window loses focus and when its owner chooses "Hide my cursor"', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board();
    $first = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $second = plan07Card($retro, $columns[1], $aliceParticipant, 'Flaky tests');
    $watchRemoval = '() => { const started = performance.now(); const overlay = document.querySelector(".lc-overlay"); const observer = new MutationObserver(() => { if (overlay.querySelector(".lc-cursor") === null) { window.plan07CursorGoneAfter = performance.now() - started; observer.disconnect(); } }); observer.observe(overlay, { childList: true }); return true; }';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$second->id}");
    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone');

    $carolPage->script($watchRemoval);
    $bobPage->script('() => { window.dispatchEvent(new Event("blur")); return true; }');

    $carolPage->assertNotPresent('.lc-cursor')
        ->assertScript('window.plan07CursorGoneAfter < 1500', true);

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$second->id}");
    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone');

    $bobPage->click('[aria-label="Hide my cursor"]')
        ->assertAriaAttribute('[aria-label="Hide my cursor"]', 'pressed', 'true')
        ->assertScript('localStorage.getItem("skrum.hideMyCursor")', 'true');
    $carolPage->assertNotPresent('.lc-cursor');

    $bobPage->hover("#card-{$first->id}")
        ->hover("#card-{$second->id}")
        ->click('[aria-label="Send a reaction 🎉"]');
    $carolPage->assertSeeIn('.lr-overlay', 'Bob Stone')
        ->assertNotPresent('.lc-cursor');

    $carolPage->hover("#card-{$second->id}")->hover("#card-{$first->id}");
    $bobPage->assertSeeIn('.lc-overlay', 'Carol Reyes');

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertAriaAttribute('[aria-label="Hide my cursor"]', 'pressed', 'true')
        ->click('[aria-label="Hide my cursor"]')
        ->assertAriaAttribute('[aria-label="Hide my cursor"]', 'pressed', 'false')
        ->hover("#card-{$first->id}")
        ->hover("#card-{$second->id}");
    $carolPage->assertSeeIn('.lc-overlay', 'Bob Stone');
});

it('[P07-02a] flies quick reactions with the sender\'s name and gathers the same emoji from two people into one bubble', function () {
    ['retro' => $retro, 'alice' => $alice, 'bob' => $bob] = plan07Board();
    $watchGathering = '() => { window.plan07Gathered = 0; new MutationObserver(() => { for (const bubble of document.querySelectorAll(".lr-reaction[data-state=\"gathering\"]")) { window.plan07Gathered = Math.max(window.plan07Gathered, Number(bubble.dataset.count)); } }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "data-count"] }); return true; }';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertCount('[role="toolbar"][aria-label="Reactions"] [aria-label^="Send a reaction "]', 6);
    }

    $alicePage->click('[aria-label="Send a reaction 👏"]');
    $bobPage->assertSeeIn('.lr-overlay', '👏')
        ->assertSeeIn('.lr-overlay', 'Alice Martin');

    $bobPage->click('[aria-label="Send a reaction 👍"]');
    $alicePage->assertSeeIn('.lr-overlay', '👍')
        ->assertSeeIn('.lr-overlay', 'Bob Stone');

    $alicePage->script($watchGathering);
    $bobPage->script($watchGathering);

    $alicePage->click('[aria-label="Send a reaction 🎉"]');
    $bobPage->click('[aria-label="Send a reaction 🎉"]');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertScript('window.plan07Gathered >= 2', true);
    }
});

it('[P07-02b] flies a reaction chosen in the full emoji picker', function () {
    plan07FakeUpstreams();

    ['retro' => $retro, 'alice' => $alice, 'bob' => $bob] = plan07Board();

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]');
    }

    $alicePage->click('[role="toolbar"][aria-label="Reactions"] [aria-label="Send a reaction"]')
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertSeeIn('[role="dialog"]', 'Send a reaction')
        ->assertVisible('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->click('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->assertNotPresent('[role="dialog"]');

    $bobPage->assertSeeIn('.lr-overlay', '🚀')
        ->assertSeeIn('.lr-overlay', 'Alice Martin');
});

it('[P07-06b] labels cursors "Participant" and sends unnamed reactions on an anonymous retro', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board(RetroPhase::Grouping, ['is_anonymous' => true]);
    $first = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $second = plan07Card($retro, $columns[1], $aliceParticipant, 'Flaky tests');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay');
    }

    $bobPage->hover("#card-{$first->id}")->hover("#card-{$second->id}");

    $carolPage->assertSeeIn('.lc-overlay', 'Participant')
        ->assertDontSeeIn('.lc-overlay', 'Bob Stone');

    $bobPage->click('[aria-label="Send a reaction 🎉"]');

    $carolPage->assertPresent('.lr-reaction')
        ->assertNotPresent('.lr-label');
});

it('[P07-05a] searches GIFs and shows them on cards through skrum, without any request from the browser to the provider', function () {
    plan07FakeUpstreams();
    plan07EnableGifs();

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
    ] = plan07Board(RetroPhase::Writing);
    $start = "[data-test=\"retro-column-{$columns[0]->id}\"]";
    $result = '[role="dialog"] [role="option"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->script(plan07RecordResourcesPastTheBoardLoad());
    }

    plan07OpenComposer($bobPage, $columns[0])
        ->assertVisible("{$start} form button:has-text(\"GIF\")")
        ->click("{$start} form button:has-text(\"GIF\")")
        ->assertSeeIn('[role="dialog"]', 'Choose a GIF')
        ->assertSeeIn('[role="dialog"]', 'Powered by GIPHY')
        ->assertCount($result, 2)
        ->fill('[role="dialog"] [aria-label="Search GIPHY"]', 'party')
        ->assertCount($result, 1)
        ->assertAttribute("{$result} img", 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded("{$result} img"), true)
        ->click($result)
        ->assertNotPresent('[role="dialog"]')
        ->assertAttribute("{$start} form img", 'src', '/gifs/party1/preview')
        ->assertPresent("{$start} form [aria-label=\"Remove GIF\"]")
        ->click("{$start} form button[type=\"submit\"]")
        ->assertPresent('article[id^="card-"] button[aria-label="GIF"]');

    $card = Card::query()->where('gif_id', 'party1')->sole();

    expect($card->content)->toBeNull();

    $bobPage->assertAttribute("#card-{$card->id} button[aria-label=\"GIF\"] img", 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded("#card-{$card->id} button[aria-label=\"GIF\"] img"), true);

    $carolPage->assertSeeIn("#card-{$card->id}", 'Hidden until the reveal')
        ->assertNotPresent("#card-{$card->id} img");

    $alicePage->press('Next')->assertSeeIn('[aria-current="step"]', 'Grouping');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertAttribute("#card-{$card->id} button[aria-label=\"GIF\"] img", 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded("#card-{$card->id} button[aria-label=\"GIF\"] img"), true)
        ->click("#card-{$card->id} button[aria-label=\"GIF\"]")
        ->assertAttribute('[role="dialog"] img', 'src', '/gifs/party1/full')
        ->assertScript(plan07ImageLoaded('[role="dialog"] img'), true);

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertScript(plan07Requested('/gifs/party1/preview'), true)
            ->assertScript(plan07ThirdPartyRequests(), 0)
            ->assertScript(plan07ForeignImages(), 0)
            ->assertScript('document.documentElement.outerHTML.includes("plan07-gif-key")', false)
            ->assertScript('document.documentElement.outerHTML.includes("giphy.com")', false);
    }

    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://api.giphy.com/v1/gifs/trending')
        && str_contains($request->url(), 'api_key=plan07-gif-key')
        && str_contains($request->url(), 'rating=pg'));
    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://api.giphy.com/v1/gifs/search')
        && str_contains($request->url(), 'q=party')
        && str_contains($request->url(), 'api_key=plan07-gif-key'));
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://media.giphy.com/party1/200w.webp');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://media.giphy.com/party1/giphy.webp');
    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'tenor'));
    Storage::assertExists('gifs/giphy/party1-preview');
    Storage::assertExists('gifs/giphy/party1-full');
});

it('[P07-05b] serves the emoji picker data itself, fetching it once from the CDN on the server', function () {
    plan07FakeUpstreams();

    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $rocket = '[role="dialog"] [role="gridcell"][aria-label="Rocket"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->script(plan07RecordResourcesPastTheBoardLoad());
        $page->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
            ->assertSee('More emoji…')
            ->click('More emoji…')
            ->assertSeeIn('[role="dialog"]', 'Add a reaction')
            ->assertPresent('[role="dialog"] [aria-label="Search emoji…"]')
            ->assertVisible($rocket)
            ->assertPresent('[role="dialog"] [role="gridcell"][aria-label="Unicorn"]')
            ->assertDontSee('Emoji list unavailable')
            ->assertScript(plan07Requested('/emoji-data/17.0.0/en/data.json'), true)
            ->assertScript(plan07Requested('/emoji-data/17.0.0/en/messages.json'), true)
            ->assertScript(plan07ThirdPartyRequests(), 0);
    }

    Http::assertSentCount(2);
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/data.json');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://cdn.jsdelivr.net/npm/emojibase-data@17.0.0/en/messages.json');
    Storage::assertExists('emoji-data/17.0.0/en/data.json');
    Storage::assertExists('emoji-data/17.0.0/en/messages.json');
});

it('[P07-03b] adds a card reaction chosen in the full emoji picker', function () {
    plan07FakeUpstreams();

    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $bobPage->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
        ->assertSee('More emoji…')
        ->click('More emoji…')
        ->assertVisible('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->click('[role="dialog"] [role="gridcell"][aria-label="Rocket"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertAriaAttribute(plan07Chip($card, '🚀', 1), 'pressed', 'true');

    $carolPage->assertAriaAttribute(plan07Chip($card, '🚀', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '🚀', 1))
        ->assertAriaAttribute(plan07Chip($card, '🚀', 2), 'pressed', 'true');

    $bobPage->assertAriaAttribute(plan07Chip($card, '🚀', 2), 'pressed', 'true');

    expect(CardReaction::query()->where('card_id', $card->id)->where('emoji', '🚀')->count())->toBe(2)
        ->and(CardReaction::query()->where('participant_id', $bobParticipant->id)->sole()->emoji)->toBe('🚀');
});

it('[P07-07b] offers the "Allow GIFs" switch when a provider is configured and stops new GIFs while keeping the existing ones', function () {
    plan07FakeUpstreams();
    plan07EnableGifs();

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board(RetroPhase::Writing);
    $card = plan07Card($retro, $columns[0], $bobParticipant, null, 0, 'party1');
    $gifButtons = '[data-test^="retro-column-"] form button:has-text("GIF")';
    $composer = "[data-test=\"retro-column-{$columns[0]->id}\"] [data-slot=\"retro-card-composer\"] textarea";
    $image = "#card-{$card->id} button[aria-label=\"GIF\"] img";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    plan07OpenComposer($bobPage, $columns[0])
        ->assertCount($gifButtons, 1)
        ->assertAttribute($image, 'src', '/gifs/party1/preview')
        ->assertScript(plan07ImageLoaded($image), true);

    plan07OpenSettings($alicePage)
        ->assertSee('Allow GIFs')
        ->assertAriaAttribute('#retro-gifs', 'checked', 'true')
        ->assertPresent('#retro-reactions')
        ->assertPresent('#retro-cursors')
        ->assertPresent('#retro-hide-vote-counts')
        ->assertPresent('#retro-locked')
        ->assertPresent('#retro-presentation')
        ->click('#retro-gifs')
        ->assertAriaAttribute('#retro-gifs', 'checked', 'false');
    plan07SaveSettings($alicePage);

    $bobPage->assertCount($gifButtons, 0)
        ->assertVisible($composer)
        ->assertCount('[data-slot="retro-column-add"]', 2)
        ->assertScript(plan07ImageLoaded($image), true)
        ->assertScript(plan07ThirdPartyRequests(), 0);

    expect($retro->fresh()->gifs_enabled)->toBeFalse()
        ->and($card->fresh()->gif_id)->toBe('party1');

    Http::assertSent(fn (Request $request): bool => str_starts_with($request->url(), 'https://api.giphy.com/v1/gifs/party1')
        && str_contains($request->url(), 'api_key=plan07-gif-key'));
});
