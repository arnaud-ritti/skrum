<?php

use App\Actions\Retros\GuestCookie;
use App\Enums\PokerDeck;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\PokerVote;
use App\Models\Retro;
use App\Models\Survey;
use App\Models\SurveyResponse;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * @return array{0: User, 1: Participant}
 */
function retroMember(Retro $retro): array
{
    $user = User::factory()->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);

    return [$user, $participant];
}

/**
 * @return array{0: User, 1: Participant}
 */
function retroFacilitator(Retro $retro): array
{
    [$user, $participant] = retroMember($retro);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    return [$user, $participant];
}

/**
 * @return array<string, string>
 */
function retroGuestCookie(Participant $participant, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::RetroScope, $participant->retro_id) => "{$participant->id}|{$secret}"];
}

function answerSurvey(Survey $survey, Participant $participant, int ...$optionIndexes): void
{
    $options = $survey->options()->get()->values();

    foreach ($optionIndexes as $index) {
        SurveyResponse::factory()->create([
            'survey_id' => $survey->id,
            'survey_option_id' => $options[$index]->id,
            'participant_id' => $participant->id,
        ]);
    }
}

function configureLlm(string $provider = 'anthropic', ?string $baseUrl = null): void
{
    config(['services.llm' => [
        'provider' => $provider,
        'key' => 'llm-secret-key',
        'model' => 'test-model',
        'base_url' => $baseUrl,
    ]]);
}

/**
 * @param  array<array-key, mixed>|string  $reply
 */
function fakeLlmReply(array|string $reply): void
{
    $text = is_string($reply) ? $reply : (string) json_encode($reply);

    Http::fake([
        'api.anthropic.com/*' => Http::response(['content' => [['type' => 'text', 'text' => $text]]]),
    ]);
}

function fakeLlmFailure(): void
{
    Http::fake([
        'api.anthropic.com/*' => Http::response(['error' => ['message' => 'invalid x-api-key llm-secret-key']], 500),
    ]);
}

function llmRequestBodies(): string
{
    return Http::recorded()
        ->map(fn (array $pair) => $pair[0]->body())
        ->implode("\n");
}

function teamMember(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($user);

    return $user;
}

function workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User
{
    $user = User::factory()->create();
    $workspace->members()->attach($user, ['role' => $role->value]);

    return $user;
}

/**
 * @return array{0: User, 1: Participant}
 */
function workspaceAdminParticipant(Retro $retro): array
{
    $user = workspaceManager($retro->team->workspace);

    return [$user, Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: PokerPlayer}
 */
function pokerMember(PokerGame $game): array
{
    $user = teamMember($game->team);

    return [$user, PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $user->id])];
}

/**
 * @return array{0: User, 1: PokerPlayer}
 */
function pokerFacilitator(PokerGame $game): array
{
    [$user, $player] = pokerMember($game);

    $game->forceFill(['facilitator_player_id' => $player->id])->save();

    return [$user, $player];
}

function pokerGuest(PokerGame $game, string $secret = 'secret'): PokerPlayer
{
    return PokerPlayer::factory()->guest($secret)->create(['poker_game_id' => $game->id]);
}

/**
 * @return array<string, string>
 */
function pokerGuestCookie(PokerPlayer $player, string $secret = 'secret'): array
{
    return [GuestCookie::name(GuestCookie::PokerScope, $player->poker_game_id) => "{$player->id}|{$secret}"];
}

function openPokerRound(PokerGame $game, ?PokerTask $task = null): PokerRound
{
    $task ??= PokerTask::factory()->create(['poker_game_id' => $game->id]);

    $round = PokerRound::factory()->create([
        'poker_task_id' => $task->id,
        'anonymous' => (bool) $game->anonymous_votes,
    ]);

    $game->forceFill(['current_task_id' => $task->id])->save();

    return $round;
}

function pokerVote(PokerRound $round, PokerPlayer $player, string $value): PokerVote
{
    return PokerVote::factory()->create([
        'poker_round_id' => $round->id,
        'poker_player_id' => $player->id,
        'value' => $value,
    ]);
}

/**
 * @return array{
 *     game: PokerGame,
 *     facilitator: User,
 *     facilitatorPlayer: PokerPlayer,
 *     member: User,
 *     memberPlayer: PokerPlayer,
 *     round: PokerRound
 * }
 */
function pokerRevealTable(PokerDeck $deck = PokerDeck::Fibonacci): array
{
    $game = PokerGame::factory()->deck($deck)->withGuestAccess()->create();
    [$facilitator, $facilitatorPlayer] = pokerFacilitator($game);
    [$member, $memberPlayer] = pokerMember($game);

    return [
        'game' => $game,
        'facilitator' => $facilitator,
        'facilitatorPlayer' => $facilitatorPlayer,
        'member' => $member,
        'memberPlayer' => $memberPlayer,
        'round' => openPokerRound($game),
    ];
}
