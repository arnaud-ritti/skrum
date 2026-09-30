<?php

use App\Enums\IntegrationProvider;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * @return array{0: PokerGame, 1: User}
 */
function shareablePokerGame(array $attributes = []): array
{
    $game = PokerGame::factory()->create([
        'title' => 'Sprint 12 sizing',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $game->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $game->team_id]);
    [$facilitator] = pokerFacilitator($game);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$game, $facilitator];
}

it('queues a game link for the facilitator', function () {
    [$game, $facilitator] = shareablePokerGame();
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Secret task title']);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertAccepted()
        ->assertJson(['channel' => 'slack', 'kind' => 'poker_link', 'status' => 'queued']);
    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'telegram'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) use ($game) {
        $json = json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return str_contains($json, 'Fran Facilitator invites you to the planning poker game \"Sprint 12 sizing\" (Platform)')
            && $job->message['blocks'][1]['elements'][0]['url'] === route('poker.show', $game)
            && ! str_contains($json, 'Secret task title');
    });
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, 'Open the game') && ! str_contains($job->html, 'Secret task title'));
});

it('posts the poker guest link only on request', function () {
    [$game, $facilitator] = shareablePokerGame(['guest_access_enabled' => true]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => $job->message['blocks'][1]['elements'][0]['url'] === route('poker.join.show', $game->guest_token));
});

it('refuses the poker guest link when guest access is off', function () {
    [$game, $facilitator] = shareablePokerGame();

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this game.']);
    Queue::assertNothingPushed();
});

it('lets workspace admins share a game', function () {
    [$game] = shareablePokerGame();
    $admin = workspaceManager($game->team->workspace);
    PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $admin->id]);

    $this->actingAs($admin)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertAccepted();
});

it('refuses other players and guests', function (string $role) {
    [$game] = shareablePokerGame(['guest_access_enabled' => true]);

    $request = $role === 'guest'
        ? $this->withCookies(pokerGuestCookie(pokerGuest($game)))->withCredentials()
        : $this->actingAs(pokerMember($game)[0]);

    $request->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])->assertForbidden();
    Queue::assertNothingPushed();
})->with(['member', 'guest']);

it('refuses an ended game', function () {
    [$game, $facilitator] = shareablePokerGame();
    $game->forceFill(['ended_at' => now()])->save();

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertForbidden()
        ->assertJson(['message' => 'This game has ended.']);
});

it('answers 404 for a disabled provider and 409 without a connection', function () {
    [$game, $facilitator] = shareablePokerGame();
    TeamIntegration::query()->where('provider', 'telegram')->delete();
    config(['services.slack.client_id' => null]);

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertNotFound();
    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'telegram'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Telegram in the team settings.']);
});

it('counts game shares apart from other throttled requests', function () {
    [$game, $facilitator] = shareablePokerGame();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($facilitator)->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']));
    }

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($facilitator)
            ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
            ->assertAccepted();
    }

    $this->actingAs($facilitator)
        ->postJson(route('poker.shares.store', $game), ['channel' => 'slack'])
        ->assertTooManyRequests();
});

it('refuses game guests before validating or checking the provider', function (array $body, bool $providersEnabled) {
    [$game] = shareablePokerGame(['guest_access_enabled' => true]);

    if (! $providersEnabled) {
        config(['services.slack.client_id' => null]);
    }

    $this->withCookies(pokerGuestCookie(pokerGuest($game)))->withCredentials()
        ->postJson(route('poker.shares.store', $game), $body)
        ->assertForbidden();
})->with([
    'invalid payload' => [['channel' => 'teams'], true],
    'disabled provider' => [['channel' => 'slack'], false],
]);
