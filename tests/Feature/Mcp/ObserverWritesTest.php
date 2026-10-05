<?php

use App\Enums\IntegrationProvider;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Mcp\Tools\Poker\AddTasks;
use App\Mcp\Tools\Poker\CreateGame;
use App\Mcp\Tools\Poker\ImportTasks;
use App\Mcp\Tools\Poker\RevealTask;
use App\Mcp\Tools\Poker\SelectTask;
use App\Mcp\Tools\Poker\SyncTask;
use App\Mcp\Tools\Retro\CompleteAction;
use App\Mcp\Tools\Retro\CreateAction;
use App\Mcp\Tools\Retro\DeleteOwnMessage;
use App\Mcp\Tools\Retro\PromoteSuggestion;
use App\Mcp\Tools\Retro\RejectSuggestion;
use App\Mcp\Tools\Retro\UpdateAction;
use App\Mcp\Tools\Retro\UpdateMessage;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;

it('refuses the write tools to an observer of the team', function (string $tool, Closure $arguments) {
    configureLlm();
    enableIntegrations(IntegrationProvider::Jira);
    Http::preventStrayRequests();
    $team = Team::factory()->create();
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $observer = teamMember($team, TeamRole::Observer);

    $toolArguments = $arguments($team, $observer);
    $storedState = fn (): array => [
        ActionItem::query()->orderBy('id')->get()->toArray(),
        Card::query()->orderBy('id')->get()->toArray(),
        SuggestedAction::query()->orderBy('id')->get()->toArray(),
        PokerGame::query()->orderBy('id')->get()->toArray(),
        PokerTask::query()->orderBy('id')->get()->toArray(),
    ];
    $stateBefore = $storedState();

    $response = actingAsMcp($observer, [McpScope::Read, McpScope::Write, McpScope::Delete])->tool($tool, $toolArguments);

    $response->assertHasErrors(['Observers can follow this session but not take part.']);
    expect($storedState())->toBe($stateBefore);
})->with([
    'action item on a team' => [CreateAction::class, fn (Team $team): array => ['team_id' => $team->id, 'content' => 'Ship it']],
    'action item on a board' => [CreateAction::class, fn (Team $team): array => ['board_id' => Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create()->id, 'content' => 'Ship it']],
    'action item update' => [UpdateAction::class, fn (Team $team, User $observer): array => ['action_id' => ActionItem::factory()->for($team)->create(['retro_id' => null, 'created_by_user_id' => $observer->id])->id, 'content' => 'Changed']],
    'action item completion' => [CompleteAction::class, fn (Team $team, User $observer): array => ['action_id' => ActionItem::factory()->for($team)->create(['retro_id' => null, 'assignee_user_id' => $observer->id])->id]],
    'own message update' => [UpdateMessage::class, fn (Team $team, User $observer): array => ['message_id' => observerCard($team, $observer)->id, 'content' => 'Changed']],
    'own message deletion' => [DeleteOwnMessage::class, fn (Team $team, User $observer): array => ['message_id' => observerCard($team, $observer)->id]],
    'suggestion promotion' => [PromoteSuggestion::class, observerSuggestion(...)],
    'suggestion rejection' => [RejectSuggestion::class, observerSuggestion(...)],
    'poker game' => [CreateGame::class, fn (Team $team): array => ['team_id' => $team->id, 'title' => 'Refinement', 'deck' => 'fibonacci']],
    'poker tasks' => [AddTasks::class, fn (Team $team): array => ['game_id' => PokerGame::factory()->for($team)->create()->id, 'tasks' => [['title' => 'One']]]],
    'poker import' => [ImportTasks::class, fn (Team $team): array => ['game_id' => PokerGame::factory()->for($team)->create()->id, 'source' => 'jira', 'query' => 'project = SK']],
    'poker reveal' => [RevealTask::class, observerPokerTask(...)],
    'poker select' => [SelectTask::class, observerPokerTask(...)],
    'poker sync' => [SyncTask::class, fn (Team $team): array => ['task_id' => observerPokerTask($team)['task_id']]],
]);

it('keeps the write tools for a member of the team', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    mcpWriter($member)->tool(CreateAction::class, ['team_id' => $team->id, 'content' => 'Ship it'])->assertOk();

    expect(ActionItem::query()->where('team_id', $team->id)->count())->toBe(1);
});

function observerCard(Team $team, User $observer): Card
{
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create();
    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $observer->id]);

    return Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id]);
}

/**
 * @return array{board_id: string, suggested_action_id: string}
 */
function observerSuggestion(Team $team): array
{
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create();

    return ['board_id' => $retro->id, 'suggested_action_id' => SuggestedAction::factory()->create(['retro_id' => $retro->id])->id];
}

/**
 * @return array{game_id: string, task_id: string}
 */
function observerPokerTask(Team $team): array
{
    $game = PokerGame::factory()->for($team)->create();

    return ['game_id' => $game->id, 'task_id' => PokerTask::factory()->create(['poker_game_id' => $game->id])->id];
}
