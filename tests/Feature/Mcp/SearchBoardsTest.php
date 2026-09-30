<?php

use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\McpGrant;
use App\Mcp\Support\LikePattern;
use App\Mcp\Tools\Retro\SearchBoards;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;

/**
 * @return array{0: Team, 1: User}
 */
function mcpSearchTeam(): array
{
    $team = Team::factory()->create();

    return [$team, teamMember($team)];
}

/**
 * @return array<int, array{board: array<string, mixed>, matches: array<int, array<string, mixed>>}>
 */
function mcpSearch(User $user, array $arguments): array
{
    return mcpStructured(actingAsMcp($user)->tool(SearchBoards::class, $arguments)->assertOk())['results'];
}

it('finds titles, summaries, action items and messages', function () {
    [$team, $user] = mcpSearchTeam();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Deploy week',
        'summary' => 'The deploy pipeline slowed us down.',
        'summary_status' => SummaryStatus::Ready,
        'ai_summary_enabled' => true,
    ]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Deploy on Fridays hurts']);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Automate the deploy']);

    $results = mcpSearch($user, ['query' => 'DEPLOY']);
    $matches = collect($results[0]['matches']);

    expect($results)->toHaveCount(1)
        ->and($results[0]['board']['id'])->toBe($retro->id)
        ->and($matches->pluck('kind')->sort()->values()->all())->toBe(['action', 'message', 'summary', 'title'])
        ->and($matches->firstWhere('kind', 'message')['id'])->toBe($card->id)
        ->and($matches->firstWhere('kind', 'action')['id'])->toBe($item->id)
        ->and($matches->firstWhere('kind', 'title')['id'])->toBeNull();
});

it('never matches hidden cards', function () {
    [$team, $user] = mcpSearchTeam();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 9']);
    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Confidential salary remark']);
    $own = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'My salary remark']);

    $results = mcpSearch($user, ['query' => 'salary']);

    expect($results)->toHaveCount(1)
        ->and(collect($results[0]['matches'])->pluck('id')->all())->toBe([$own->id])
        ->and(json_encode($results))->not->toContain('Confidential');

    expect(mcpSearch($user, ['query' => 'Confidential']))->toBe([]);
});

it('does not match summaries of unfinished or opted-out boards', function () {
    [$team, $user] = mcpSearchTeam();
    Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create(['summary' => 'Draft about latency']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['summary' => 'Old latency text', 'ai_summary_enabled' => false]);

    expect(mcpSearch($user, ['query' => 'latency']))->toBe([]);
});

it('escapes wildcards', function () {
    [$team, $user] = mcpSearchTeam();
    Retro::factory()->for($team)->create(['title' => '100% done']);
    Retro::factory()->for($team)->create(['title' => '1000 done']);
    Retro::factory()->for($team)->create(['title' => 'snake_case names']);
    Retro::factory()->for($team)->create(['title' => 'snakeXcase names']);
    Retro::factory()->for($team)->create(['title' => 'path\\to\\file']);

    expect(collect(mcpSearch($user, ['query' => '0%']))->pluck('board.title')->all())->toBe(['100% done'])
        ->and(collect(mcpSearch($user, ['query' => 'e_c']))->pluck('board.title')->all())->toBe(['snake_case names'])
        ->and(collect(mcpSearch($user, ['query' => 'h\\t']))->pluck('board.title')->all())->toBe(['path\\to\\file']);
});

it('searches only visible boards and one team when asked', function () {
    [$team, $user] = mcpSearchTeam();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $other->members()->attach($user);
    $mine = Retro::factory()->for($team)->create(['title' => 'Budget review']);
    $siblings = Retro::factory()->for($other)->create(['title' => 'Budget planning']);
    Retro::factory()->create(['title' => 'Budget secret']);

    expect(collect(mcpSearch($user, ['query' => 'budget']))->pluck('board.id')->sort()->values()->all())
        ->toBe(collect([$mine->id, $siblings->id])->sort()->values()->all())
        ->and(collect(mcpSearch($user, ['query' => 'budget', 'team_id' => $team->id]))->pluck('board.id')->all())->toBe([$mine->id]);

    actingAsMcp($user)->tool(SearchBoards::class, ['query' => 'budget', 'team_id' => Team::factory()->create()->id])->assertHasErrors(['Not found.']);
});

it('validates the query and the limit', function (array $arguments) {
    [, $user] = mcpSearchTeam();

    actingAsMcp($user)->tool(SearchBoards::class, $arguments)->assertHasErrors();
})->with([
    'too short' => [['query' => 'a']],
    'too long' => [['query' => str_repeat('a', 101)]],
    'limit above 20' => [['query' => 'retro', 'limit' => 21]],
]);

it('limits searches per token', function () {
    [, $user] = mcpSearchTeam();
    $pending = actingAsMcp($user);
    $tokenId = app(McpGrant::class)->tokenId;

    foreach (range(1, 20) as $attempt) {
        RateLimiter::hit("mcp-search:{$tokenId}");
    }

    $pending->tool(SearchBoards::class, ['query' => 'retro'])->assertHasErrors(['Too many searches, wait a moment.']);
});

it('builds snippets around the match', function () {
    $text = str_repeat('lorem ', 60).'the needle sits here '.str_repeat('ipsum ', 60);
    $snippet = LikePattern::snippet($text, 'NEEDLE');

    expect(mb_strlen($snippet))->toBeLessThanOrEqual(160)
        ->and($snippet)->toContain('needle')
        ->and($snippet)->toStartWith('…')
        ->and($snippet)->toEndWith('…')
        ->and(LikePattern::snippet('short text', 'text'))->toBe('short text');
});
