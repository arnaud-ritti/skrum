<?php

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
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Vote;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;

it('never returns emails, guest tokens or guest links', function (string $tool, Closure $arguments) {
    configureLlm();
    $retro = Retro::factory()->withGuestAccess()->inPhase(RetroPhase::Completed)->create([
        'title' => 'Privacy board',
        'summary' => 'Privacy summary',
        'summary_status' => SummaryStatus::Ready,
    ]);
    [$user, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    Card::factory()->create(['retro_id' => $retro->id, 'participant_id' => $guest->id, 'content' => 'Privacy card']);
    ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Privacy action', 'assignee_user_id' => $user->id]);

    $json = json_encode(mcpStructured(actingAsMcp($user)->tool($tool, $arguments($retro))->assertOk()));

    expect($json)->not->toContain($user->email)
        ->and($json)->not->toContain($retro->guest_token)
        ->and($json)->not->toContain('/join/')
        ->and($json)->not->toMatch('/[\w.+-]+@[\w-]+\.[\w.]+/');
})->with([
    'teams' => [ListTeams::class, fn (Retro $retro) => []],
    'members' => [ListTeamMembers::class, fn (Retro $retro) => ['team_id' => $retro->team_id]],
    'boards' => [ListBoards::class, fn (Retro $retro) => ['team_id' => $retro->team_id]],
    'search' => [SearchBoards::class, fn (Retro $retro) => ['query' => 'privacy']],
    'actions' => [ListActionItems::class, fn (Retro $retro) => ['status' => 'all']],
    'board actions' => [ListBoardActionItems::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'messages' => [ListMessages::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'summary' => [GetSummary::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'insights' => [ListInsights::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'health' => [GetHealth::class, fn (Retro $retro) => ['board_id' => $retro->id]],
    'roti' => [GetRoti::class, fn (Retro $retro) => ['board_id' => $retro->id]],
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
        $logged[] = $event->message.json_encode($event->context);
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
