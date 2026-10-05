<?php

use App\Actions\Poker\BuildPokerSnapshot;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    config(['mail.default' => 'smtp']);
});

function shareSnapshot(Retro $retro, Participant $viewer): array
{
    return resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);
}

function connectShareChannels(Team $team): void
{
    TeamIntegration::factory()->slack()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $team->id]);
}

it('offers every channel to a facilitator who is a team member', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    connectShareChannels($retro->team);
    [, $facilitator] = retroFacilitator($retro);

    expect(shareSnapshot($retro, $facilitator)['integrations'])->toBe(['slack' => true, 'telegram' => true, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => true]);
});

it('offers channels to workspace admins', function () {
    $retro = Retro::factory()->create();
    connectShareChannels($retro->team);
    [, $admin] = workspaceAdminParticipant($retro);

    expect(shareSnapshot($retro, $admin)['integrations'])->toBe(['slack' => true, 'telegram' => true, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => true]);
});

it('offers nothing to other members, guests and a facilitator outside the team', function (Closure $viewerOf) {
    $retro = Retro::factory()->withGuestAccess()->create();
    connectShareChannels($retro->team);
    IntegrationDelivery::factory()->forSubject($retro)->create();
    $viewer = $viewerOf($retro);

    $snapshot = shareSnapshot($retro, $viewer);

    expect($snapshot['integrations'])->toBe(['slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => false])
        ->and($snapshot['linkDeliveries'])->toBe([]);
})->with([
    'member' => [fn (Retro $retro) => retroMember($retro)[1]],
    'guest' => [fn (Retro $retro) => Participant::factory()->guest()->create(['retro_id' => $retro->id])],
    'facilitator outside the team' => [function (Retro $retro) {
        $participant = Participant::factory()->create(['retro_id' => $retro->id]);
        $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

        return $participant;
    }],
]);

it('hides channels that are disabled or not active', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->reconnectRequired()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    config(['services.telegram.bot_token' => null]);
    [, $facilitator] = retroFacilitator($retro);

    expect(shareSnapshot($retro, $facilitator)['integrations'])->toBe(['slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false, 'email' => true]);
});

it('offers email only with a delivering mailer', function (string $mailer) {
    config(['mail.default' => $mailer]);
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $facilitator] = retroFacilitator($retro);

    $snapshot = shareSnapshot($retro, $facilitator);

    expect($snapshot['integrations']['email'])->toBeFalse()
        ->and($snapshot['results']['emailRecipients'])->toBeNull();
})->with(['log', 'array']);

it('lists the latest results delivery per channel for sharers only', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);
    $results = fn (array $attributes) => IntegrationDelivery::factory()->forSubject($retro)->create(['kind' => IntegrationDeliveryKind::RetroResults, ...$attributes]);
    $results(['status' => 'failed', 'error' => 'old', 'created_at' => now()->subHour()]);
    $slack = $results(['status' => 'sent', 'sent_at' => now()->subMinutes(2), 'created_at' => now()->subMinutes(2)]);
    $email = $results(['channel' => IntegrationDeliveryChannel::Email, 'status' => 'sent', 'recipient_count' => 4, 'sent_at' => now()]);
    IntegrationDelivery::factory()->forSubject($retro)->create(['created_at' => now()->addMinute()]);

    $deliveries = shareSnapshot($retro, $facilitator)['results']['deliveries'];

    expect(array_column($deliveries, 'id'))->toBe([$email->id, $slack->id])
        ->and($deliveries[0])->toMatchArray(['channel' => 'email', 'kind' => 'retro_results', 'recipientCount' => 4])
        ->and(shareSnapshot($retro, $member)['results']['deliveries'])->toBe([]);
});

it('counts email recipients for sharers', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $member] = retroMember($retro);
    teamMember($retro->team);
    $unverified = User::factory()->unverified()->create();
    $retro->team->members()->attach($unverified);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $unverified->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    workspaceAdminParticipant($retro);

    expect(shareSnapshot($retro, $facilitator)['results']['emailRecipients'])->toBe(['participants' => 2, 'team' => 3])
        ->and(shareSnapshot($retro, $member)['results']['emailRecipients'])->toBeNull();
});

it('lists the latest link delivery per channel', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [, $facilitator] = retroFacilitator($retro);
    IntegrationDelivery::factory()->forSubject($retro)->create(['created_at' => now()->subMinute()]);
    $latest = IntegrationDelivery::factory()->forSubject($retro)->failed('Reconnect Slack in the team settings.')->create();

    $snapshot = shareSnapshot($retro, $facilitator);

    expect(array_column($snapshot['linkDeliveries'], 'id'))->toBe([$latest->id])
        ->and($snapshot['linkDeliveries'][0])->toMatchArray(['status' => 'failed', 'error' => 'Reconnect Slack in the team settings.'])
        ->and($snapshot['results'])->toBeNull();
});

it('offers poker shares to the facilitator and workspace admins while the game is open', function () {
    $game = PokerGame::factory()->create();
    connectShareChannels($game->team);
    [, $facilitator] = pokerFacilitator($game);
    [, $member] = pokerMember($game);
    $admin = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => workspaceManager($game->team->workspace)->id]);
    $guest = pokerGuest($game);
    $delivery = IntegrationDelivery::factory()->forSubject($game)->sent()->create();
    $snapshot = fn (PokerPlayer $player) => resolve(BuildPokerSnapshot::class)->handle($game->fresh(), $player->fresh());

    expect($snapshot($facilitator)['share'])->toBe(['slack' => true, 'telegram' => true, 'msteams' => false, 'mattermost' => false, 'webhook' => false])
        ->and(array_column($snapshot($facilitator)['deliveries'], 'id'))->toBe([$delivery->id])
        ->and($snapshot($admin)['share'])->toBe(['slack' => true, 'telegram' => true, 'msteams' => false, 'mattermost' => false, 'webhook' => false])
        ->and($snapshot($member)['share'])->toBe(['slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false])
        ->and($snapshot($member)['deliveries'])->toBeEmpty()
        ->and($snapshot($guest)['share'])->toBe(['slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false])
        ->and($snapshot($guest)['deliveries'])->toBeEmpty();

    $game->forceFill(['ended_at' => now()])->save();

    expect($snapshot($facilitator)['share'])->toBe(['slack' => false, 'telegram' => false, 'msteams' => false, 'mattermost' => false, 'webhook' => false]);
});
