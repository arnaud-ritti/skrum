<?php

use App\Enums\CardSentiment;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\Survey;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Vote;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    Notification::fake();
    config(['mail.default' => 'smtp']);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

/**
 * Posts the recap to both chats and renders the mail; returns the three
 * payloads as text.
 *
 * @return array{slack: string, telegram: string, email: string}
 */
function sharedRecapTexts(Retro $retro, User $sharer): array
{
    test()->actingAs($sharer)->postJson(route('retros.shares.store', $retro), ['channel' => 'slack', 'kind' => 'results'])->assertAccepted();
    test()->actingAs($sharer)->postJson(route('retros.shares.store', $retro), ['channel' => 'telegram', 'kind' => 'results'])->assertAccepted();

    $slack = Queue::pushed(DeliverToSlack::class)->first();
    $telegram = Queue::pushed(DeliverToTelegram::class)->first();

    return [
        'slack' => json_encode($slack->message, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        'telegram' => $telegram->html,
        'email' => (string) new RetroResultsNotification($retro->id)->toMail($sharer)->render(),
    ];
}

/**
 * @return array{0: Retro, 1: User}
 */
function redactionRetro(bool $anonymous): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['is_anonymous' => $anonymous]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    [$facilitator] = retroFacilitator($retro);

    $author = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Author Zelda'])->id]);
    $voter = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Voter Victor'])->id]);
    $creator = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => User::factory()->create(['name' => 'Creator Cora'])->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Guest Gus']);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Pains']);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => 'Deploys are slow',
    ]);
    $card->forceFill(['sentiment' => CardSentiment::Negative, 'category' => 'Deployment pain'])->save();
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id]);
    CardComment::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $voter->id, 'content' => 'Secret comment text']);
    ActionItem::factory()->assignedTo(User::factory()->create(['name' => 'Assignee Ada']))->create([
        'retro_id' => $retro->id,
        'content' => 'Speed up deploys',
        'created_by_participant_id' => $creator->id,
    ]);
    ActionItem::factory()->assignedToGuest($guest)->create(['content' => 'Write the runbook', 'created_by_participant_id' => $creator->id]);
    RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Theme Tango']);
    Survey::factory()->create(['retro_id' => $retro->id, 'question' => 'Survey question Quinn']);

    return [$retro, $facilitator];
}

it('keeps authors out of every channel on anonymous retros', function () {
    [$retro, $facilitator] = redactionRetro(anonymous: true);

    expect(sharedRecapTexts($retro, $facilitator))->each->toContain('Deploys are slow')->toContain('Assignee Ada')->toContain('Guest Gus (guest)')->not->toContain('Author Zelda')->not->toContain('Voter Victor')->not->toContain('Creator Cora')->not->toContain($facilitator->name);
});

it('names participants but never card authors on named retros', function () {
    [$retro, $facilitator] = redactionRetro(anonymous: false);

    $texts = sharedRecapTexts($retro, $facilitator);
    expect($texts)->each->toContain('Creator Cora')
        ->toContain('Author Zelda')
        ->and($texts['slack'])->not->toMatch('/Deploys are slow[^"]*Author Zelda/')
        ->and($texts['telegram'])->not->toMatch('/Deploys are slow[^\n]*Author Zelda/');
});

it('never sends comments, surveys, themes, sentiment or health answers to the chats', function () {
    [$retro, $facilitator] = redactionRetro(anonymous: false);

    expect(sharedRecapTexts($retro, $facilitator))->each->not->toContain('Secret comment text')->not->toContain('Survey question Quinn')->not->toContain('Theme Tango')->not->toContain('Deployment pain')->not->toContain('negative')->not->toContain('xoxp-test-token')->not->toContain('hooks.slack.com')->not->toContain($retro->guest_token);
});
