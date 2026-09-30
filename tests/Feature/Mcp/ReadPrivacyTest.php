<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Enums\HealthStatement;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\McpContext;
use App\Mcp\Tools\Retro\GetHealth;
use App\Mcp\Tools\Retro\GetRoti;
use App\Mcp\Tools\Retro\GetSummary;
use App\Mcp\Tools\Retro\ListActionItems;
use App\Mcp\Tools\Retro\ListBoardActionItems;
use App\Mcp\Tools\Retro\ListBoards;
use App\Mcp\Tools\Retro\ListInsights;
use App\Mcp\Tools\Retro\ListMessages;
use App\Mcp\Tools\Retro\ListTeamMembers;
use App\Mcp\Tools\Retro\ListTeams;
use App\Mcp\Tools\Retro\SearchBoards;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\RotiVote;
use App\Models\SuggestedAction;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;

it('never returns emails, guest secrets or guest links', function (string $tool, Closure $arguments, Closure $expected) {
    configureLlm();
    $retro = Retro::factory()->withGuestAccess()->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'title' => 'Privacy board',
        'summary' => 'Privacy summary',
        'summary_status' => SummaryStatus::Ready,
        'ai_summary_enabled' => true,
        'summary_generated_at' => now(),
        'completed_at' => now(),
    ]);
    app(FreezeHealthStatements::class)->handle($retro);
    [$user, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Zorgon Guestname']);
    $memberCard = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'content' => 'Privacy member card']);
    $guestCard = Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $guest->id, 'content' => 'Privacy card']);
    ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Privacy action', 'assignee_user_id' => $user->id]);
    HealthCheckAnswer::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'statement' => HealthStatement::Vision->value, 'score' => 8]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4]);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Privacy theme']);
    $theme->cards()->attach([$memberCard->id, $guestCard->id]);
    SuggestedAction::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'content' => 'Privacy suggestion']);

    $json = json_encode(mcpStructured(actingAsMcp($user)->tool($tool, $arguments($retro))->assertOk()));

    expect($json)->toContain($expected($retro, $user))
        ->and($json)->not->toContain($user->email)
        ->and($json)->not->toContain($retro->guest_token)
        ->and($json)->not->toContain($guest->guest_secret_hash)
        ->and($json)->not->toContain('"secret"')
        ->and($json)->not->toContain('/join/')
        ->and($json)->not->toMatch('/[\w.+-]+@[\w-]+\.[\w.]+/');
})->with([
    'teams' => [ListTeams::class, fn (Retro $retro) => [], fn (Retro $retro) => $retro->team->name],
    'members' => [ListTeamMembers::class, fn (Retro $retro) => ['team_id' => $retro->team_id], fn (Retro $retro, User $user) => $user->name],
    'boards' => [ListBoards::class, fn (Retro $retro) => ['team_id' => $retro->team_id], fn () => 'Privacy board'],
    'search' => [SearchBoards::class, fn (Retro $retro) => ['query' => 'privacy'], fn () => 'Privacy board'],
    'actions' => [ListActionItems::class, fn (Retro $retro) => ['status' => 'all'], fn () => 'Privacy action'],
    'board actions' => [ListBoardActionItems::class, fn (Retro $retro) => ['board_id' => $retro->id], fn () => 'Privacy action'],
    'messages' => [ListMessages::class, fn (Retro $retro) => ['board_id' => $retro->id], fn () => 'Privacy card'],
    'summary' => [GetSummary::class, fn (Retro $retro) => ['board_id' => $retro->id], fn () => 'Privacy summary'],
    'insights' => [ListInsights::class, fn (Retro $retro) => ['board_id' => $retro->id], fn () => 'Privacy theme'],
    'health' => [GetHealth::class, fn (Retro $retro) => ['board_id' => $retro->id], fn () => '"status":"completed"'],
    'roti' => [GetRoti::class, fn (Retro $retro) => ['board_id' => $retro->id], fn () => '"average":4'],
]);

it('never returns the viewer as a voter of a card', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);

    $json = json_encode(mcpStructured(actingAsMcp($user)->tool(ListMessages::class, ['board_id' => $retro->id])));

    expect($json)->not->toContain('myVotes')
        ->and($json)->not->toContain('voters');
});

it('keeps the bearer token out of logged exception context', function () {
    $logged = [];
    Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$logged): void {
        $context = collect($event->context)
            ->map(fn (mixed $value) => $value instanceof Throwable ? (string) $value : json_encode($value))
            ->implode("\n");

        $logged[] = "{$event->message}\n{$context}";
    });
    app()->bind(McpContext::class, fn () => throw new RuntimeException('resolver crash'));
    $user = teamMember(Team::factory()->create());
    $token = issueTestMcpToken($user);

    postMcp($token, [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'tools/call',
        'params' => ['name' => 'retro.teams.list', 'arguments' => []],
    ]);

    $plainSecret = explode('|', $token, 2)[1];

    expect(implode("\n", $logged))->toContain('resolver crash')
        ->not->toContain($token)
        ->not->toContain($plainSecret);
});
