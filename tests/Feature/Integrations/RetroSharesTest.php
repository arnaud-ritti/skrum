<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\Card;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
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
 * @return array{0: Retro, 1: User}
 */
function shareableRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    [$facilitator] = retroFacilitator($retro);
    $facilitator->forceFill(['name' => 'Fran Facilitator'])->save();

    return [$retro, $facilitator];
}

function slackJobJson(DeliverToSlack $job): string
{
    return json_encode($job->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

it('queues a board link to Slack for the facilitator', function () {
    [$retro, $facilitator] = shareableRetro();

    $response = $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'slack', 'kind' => 'retro_link', 'status' => 'queued', 'requestedBy' => 'Fran Facilitator']);

    $delivery = IntegrationDelivery::query()->sole();
    expect($response->json('id'))->toBe($delivery->id);
    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job) use ($retro, $delivery) {
        $json = slackJobJson($job);

        return $job->deliveryId === $delivery->id
            && str_contains($json, 'Fran Facilitator invites you to the retrospective \"Sprint 42\" (Platform)')
            && str_contains($json, route('retros.show', $retro))
            && ! str_contains($json, $retro->guest_token);
    });
});

it('queues links to Telegram', function () {
    [$retro, $facilitator] = shareableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'link'])
        ->assertAccepted()
        ->assertJson(['channel' => 'telegram']);

    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, '<a href="'.route('retros.show', $retro).'">Open the retrospective</a>'));
});

it('posts the guest link only on request', function () {
    [$retro, $facilitator] = shareableRetro(attributes: ['guest_access_enabled' => true]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link', 'include_guest_link' => true])
        ->assertAccepted();
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();

    $urls = collect(Queue::pushed(DeliverToSlack::class))->map(fn (DeliverToSlack $job) => $job->message['blocks'][1]['elements'][0]['url']);
    expect($urls->all())->toBe([route('retros.join.show', $retro->guest_token), route('retros.show', $retro)]);
});

it('refuses the guest link when guest access is off', function () {
    [$retro, $facilitator] = shareableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link', 'include_guest_link' => true])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['include_guest_link' => 'Guest access is off for this retrospective.']);
    Queue::assertNothingPushed();
});

it('lets workspace admins share', function () {
    [$retro] = shareableRetro();
    [$admin] = workspaceAdminParticipant($retro);

    $this->actingAs($admin)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();
});

it('refuses other members, guests and a facilitator who left the team', function (string $role) {
    [$retro, $facilitator] = shareableRetro(attributes: ['guest_access_enabled' => true]);

    $request = match ($role) {
        'member' => $this->actingAs(retroMember($retro)[0]),
        'guest' => $this->withCookies(retroGuestCookie(Participant::factory()->guest()->create(['retro_id' => $retro->id])))->withCredentials(),
        'former facilitator' => (function () use ($retro, $facilitator) {
            $retro->team->members()->detach($facilitator);

            return $this->actingAs($facilitator);
        })(),
    };

    $request->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertForbidden();
    Queue::assertNothingPushed();
})->with(['member', 'guest', 'former facilitator']);

it('sends no board content in a link', function () {
    [$retro, $facilitator] = shareableRetro(attributes: ['guest_access_enabled' => true]);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'Secret card text']);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'link'])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => ! str_contains(slackJobJson($job), 'Secret card text'));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => ! str_contains($job->html, 'Secret card text'));
});

it('refuses a link on a completed retro and a recap before completion', function (RetroPhase $phase, string $kind, string $message) {
    [$retro, $facilitator] = shareableRetro($phase);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => $kind])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['kind' => $message]);
    Queue::assertNothingPushed();
})->with([
    'link after completion' => [RetroPhase::Completed, 'link', 'This retrospective is completed. Share its results instead.'],
    'recap while writing' => [RetroPhase::Writing, 'results', 'Results can be shared once the retrospective is completed.'],
    'recap while discussing' => [RetroPhase::Discussing, 'results', 'Results can be shared once the retrospective is completed.'],
]);

it('queues the results recap on a completed retro', function () {
    [$retro, $facilitator] = shareableRetro(RetroPhase::Completed);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'results'])
        ->assertAccepted()
        ->assertJson(['kind' => 'retro_results']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'results', 'include_guest_link' => true])
        ->assertAccepted();

    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => str_contains(slackJobJson($job), 'Results of the retrospective \"Sprint 42\"'));
    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => str_contains($job->html, 'Results of the retrospective &quot;Sprint 42&quot;')
        && ! str_contains($job->html, $retro->guest_token));
});

it('answers 404 when the provider is disabled', function () {
    [$retro, $facilitator] = shareableRetro();
    disableIntegrations();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertNotFound();
});

it('refuses a team that is not connected or must reconnect', function () {
    [$retro, $facilitator] = shareableRetro();
    TeamIntegration::query()->where('provider', 'telegram')->delete();
    TeamIntegration::query()->where('provider', 'slack')->update(['status' => 'reconnect_required']);

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'link'])
        ->assertConflict()
        ->assertJson(['message' => 'Connect Telegram in the team settings.']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertConflict()
        ->assertJson(['message' => 'Reconnect Slack in the team settings.']);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});

it('limits shares to five a minute', function () {
    [$retro, $facilitator] = shareableRetro();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($facilitator)
            ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
            ->assertAccepted();
    }

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertTooManyRequests();
});

it('counts shares apart from other throttled requests', function () {
    [$retro, $facilitator] = shareableRetro();

    foreach (range(1, 5) as $attempt) {
        $this->actingAs($facilitator)->get(route('gifs.show', ['gif' => 'abc123', 'size' => 'preview']));
    }

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'link'])
        ->assertAccepted();
});

it('refuses guests before validating or checking the provider', function (array $body, bool $providersEnabled) {
    [$retro] = shareableRetro(attributes: ['guest_access_enabled' => true]);

    if (! $providersEnabled) {
        disableIntegrations();
    }

    $this->withCookies(retroGuestCookie(Participant::factory()->guest()->create(['retro_id' => $retro->id])))->withCredentials()
        ->postJson(route('retros.shares.store', $retro), $body)
        ->assertForbidden();
})->with([
    'invalid payload' => [['channel' => 'teams', 'kind' => 'everything'], true],
    'disabled provider' => [['channel' => 'slack', 'kind' => 'link'], false],
]);

it('validates the channel and the kind', function (array $body, string $field) {
    [$retro, $facilitator] = shareableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.shares.store', $retro), $body)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'email is not a chat' => [['channel' => 'email', 'kind' => 'link'], 'channel'],
    'unknown channel' => [['channel' => 'teams', 'kind' => 'link'], 'channel'],
    'unknown kind' => [['channel' => 'slack', 'kind' => 'everything'], 'kind'],
    'guest link not a boolean' => [['channel' => 'slack', 'kind' => 'link', 'include_guest_link' => 'maybe'], 'include_guest_link'],
]);
