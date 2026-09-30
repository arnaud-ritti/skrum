<?php

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Mcp\Prompts\AnalyzeRetro;
use App\Mcp\Prompts\TeamHealth;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;

/**
 * One team with a Discussing board (guest access on, a guest, another
 * member's card, the user's action item, two pending suggestions), a
 * Writing board holding two of the user's cards, and a poker game the
 * user facilitates with a voted current task and a second task.
 *
 * @return array<string, mixed>
 */
function mcpSweepWorld(): array
{
    $workspace = Workspace::factory()->create();
    $team = Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sweep team']);

    $user = User::factory()->create(['email' => 'sweep-user@example.test', 'name' => 'Sweep User']);
    $other = User::factory()->create(['email' => 'sweep-other@example.test', 'name' => 'Sweep Other']);

    foreach ([$user, $other] as $member) {
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member);
    }

    $discussing = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Discussing)->create([
        'team_id' => $team->id,
        'title' => 'Sweep board',
    ]);
    $mine = Participant::factory()->create(['retro_id' => $discussing->id, 'user_id' => $user->id]);
    $theirs = Participant::factory()->create(['retro_id' => $discussing->id, 'user_id' => $other->id]);
    Participant::factory()->guest('guest-secret-value')->create(['retro_id' => $discussing->id]);
    Card::factory()->create(['retro_id' => $discussing->id, 'participant_id' => $theirs->id, 'content' => 'Sweep message']);

    $actionItem = ActionItem::factory()->create([
        'retro_id' => $discussing->id,
        'content' => 'Sweep agreement',
        'created_by_participant_id' => $mine->id,
        'created_by_user_id' => $user->id,
        'assignee_user_id' => $other->id,
    ]);

    $promote = SuggestedAction::factory()->create(['retro_id' => $discussing->id, 'content' => 'Promote me']);
    $reject = SuggestedAction::factory()->create(['retro_id' => $discussing->id, 'content' => 'Reject me', 'position' => 1]);

    $writing = Retro::factory()->inPhase(RetroPhase::Writing)->create(['team_id' => $team->id]);
    $writer = Participant::factory()->create(['retro_id' => $writing->id, 'user_id' => $user->id]);
    $editable = Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $writer->id]);
    $deletable = Card::factory()->create(['retro_id' => $writing->id, 'participant_id' => $writer->id, 'position' => 1]);

    $game = PokerGame::factory()->create(['team_id' => $team->id]);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id]);
    $game->update(['facilitator_player_id' => $player->id]);
    $current = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    $next = PokerTask::factory()->create(['poker_game_id' => $game->id]);
    pokerVote(openPokerRound($game, $current), $player, '5');

    return [
        'user' => $user,
        'team' => $team,
        'discussing' => $discussing,
        'writing' => $writing,
        'actionItem' => $actionItem,
        'promote' => $promote,
        'reject' => $reject,
        'editable' => $editable,
        'deletable' => $deletable,
        'game' => $game,
        'current' => $current,
        'next' => $next,
        'secrets' => [
            'sweep-user@example.test',
            'sweep-other@example.test',
            $discussing->guest_token,
            $writing->guest_token,
            $game->guest_token,
            'guest-secret-value',
            'guest_secret_hash',
        ],
    ];
}

/**
 * @return array<string, Closure(array<string, mixed>): array<string, mixed>>
 */
function mcpSweepArguments(): array
{
    return [
        'retro.teams.list' => fn (array $w): array => [],
        'retro.team.members.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'retro.boards.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'retro.boards.search' => fn (array $w): array => ['query' => 'Sweep'],
        'retro.actions.list' => fn (array $w): array => ['status' => 'all'],
        'retro.board.messages.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.summary.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.actions.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.insights.list' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.health.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'retro.board.roti.get' => fn (array $w): array => ['board_id' => $w['discussing']->id],
        'poker.games.list' => fn (array $w): array => ['team_id' => $w['team']->id],
        'poker.game.get' => fn (array $w): array => ['game_id' => $w['game']->id],
        'poker.game.tasks.list' => fn (array $w): array => ['game_id' => $w['game']->id],
        'retro.actions.create' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'content' => 'New sweep item'],
        'retro.actions.update' => fn (array $w): array => ['action_id' => $w['actionItem']->id, 'content' => 'Edited sweep item'],
        'retro.actions.complete' => fn (array $w): array => ['action_id' => $w['actionItem']->id],
        'retro.board.suggested_actions.promote' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'suggested_action_id' => $w['promote']->id],
        'retro.board.suggested_actions.reject' => fn (array $w): array => ['board_id' => $w['discussing']->id, 'suggested_action_id' => $w['reject']->id],
        'retro.board.messages.update' => fn (array $w): array => ['message_id' => $w['editable']->id, 'content' => 'Edited sweep card'],
        'poker.games.create' => fn (array $w): array => ['team_id' => $w['team']->id, 'title' => 'Sweep game', 'deck' => 'fibonacci'],
        'poker.game.tasks.add' => fn (array $w): array => ['game_id' => $w['game']->id, 'tasks' => [['title' => 'Sweep story']]],
        'poker.game.task.select' => fn (array $w): array => ['game_id' => $w['game']->id, 'task_id' => $w['next']->id],
        'poker.game.task.reveal' => fn (array $w): array => ['game_id' => $w['game']->id, 'task_id' => $w['current']->id],
        'retro.board.messages.delete_own' => fn (array $w): array => ['message_id' => $w['deletable']->id],
    ];
}

it('sweeps every contract tool', function () {
    $swept = array_keys(mcpSweepArguments());
    sort($swept);

    expect($swept)->toBe(mcpContractToolNames());
});

it('never returns an email, a guest token, a guest link or a secret', function (string $name) {
    configureLlm();
    $world = mcpSweepWorld();

    actingAsMcp($world['user'], McpScope::cases())
        ->tool(mcpToolClass($name), mcpSweepArguments()[$name]($world))
        ->assertHasNoErrors()
        ->assertDontSee($world['secrets']);
})->with(array_keys(mcpSweepArguments()));

it('never puts secrets in prompts', function () {
    configureLlm();
    $world = mcpSweepWorld();
    $server = actingAsMcp($world['user'], McpScope::cases());

    $analysis = mcpPromptText($server->prompt(AnalyzeRetro::class, ['board_id' => $world['discussing']->id])->assertOk());
    $health = mcpPromptText($server->prompt(TeamHealth::class, ['team_id' => $world['team']->id])->assertOk());

    expect($analysis)->not->toContain(...$world['secrets'])
        ->and($health)->not->toContain(...$world['secrets']);
});
