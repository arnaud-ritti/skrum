<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\RetroPhase;
use App\Events\Retros\ResultsChanged;
use App\Models\Card;
use App\Models\Column;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Http::preventStrayRequests();
    Notification::fake();
    Event::fake([ResultsChanged::class]);
    config(['mail.default' => 'smtp']);
});

/**
 * @return array{0: Retro, 1: User}
 */
function emailableRetro(RetroPhase $phase = RetroPhase::Completed, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create(['title' => 'Sprint 42', ...$attributes]);
    [$facilitator] = retroFacilitator($retro);

    return [$retro, $facilitator];
}

it('emails the results to participants with an account', function () {
    [$retro, $facilitator] = emailableRetro();
    [$participant] = retroMember($retro);
    $bystander = teamMember($retro->team);
    $unverified = User::factory()->unverified()->create();
    $retro->team->members()->attach($unverified);
    Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $unverified->id]);
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted()
        ->assertJson(['channel' => 'email', 'kind' => 'retro_results', 'status' => 'sent', 'recipientCount' => 2]);

    Notification::assertSentTo([$facilitator, $participant], RetroResultsNotification::class, fn (RetroResultsNotification $notification) => $notification->retroId === $retro->id);
    Notification::assertNotSentTo([$bystander, $unverified], RetroResultsNotification::class);
    Notification::assertCount(2);
    expect(IntegrationDelivery::query()->sole())
        ->channel->toBe(IntegrationDeliveryChannel::Email)
        ->kind->toBe(IntegrationDeliveryKind::RetroResults)
        ->status->toBe(IntegrationDeliveryStatus::Sent)
        ->recipient_count->toBe(2)
        ->requested_by_user_id->toBe($facilitator->id);
    Event::assertDispatched(ResultsChanged::class);
});

it('emails every team member on request', function () {
    [$retro, $facilitator] = emailableRetro();
    $bystander = teamMember($retro->team);
    [$admin] = workspaceAdminParticipant($retro);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertAccepted()
        ->assertJson(['recipientCount' => 2]);

    Notification::assertSentTo([$facilitator, $bystander], RetroResultsNotification::class);
    Notification::assertNotSentTo($admin, RetroResultsNotification::class);
});

it('sends each mail in the recipient\'s locale', function () {
    [$retro, $facilitator] = emailableRetro();
    $facilitator->forceFill(['locale' => 'fr'])->save();
    [$participant] = retroMember($retro);
    $participant->forceFill(['locale' => 'de'])->save();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted();

    Notification::assertSentTo($facilitator, RetroResultsNotification::class, fn ($notification, $channels, $notifiable, $locale) => $locale === 'fr');
    Notification::assertSentTo($participant, RetroResultsNotification::class, fn ($notification, $channels, $notifiable, $locale) => $locale === 'de');
});

it('writes the recap, the health score and the link in the mail', function () {
    [$retro, $facilitator] = emailableRetro();
    attachHealthCheck($retro);
    answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), ['vision' => 4]);
    closeHealthCheck($retro);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);
    $html = (string) $mail->render();

    expect($mail->subject)->toBe("Sprint 42 · {$retro->team->name} — no action")
        ->and($html)->toContain('Health check: 4.0/5')
        ->and($html)->toContain(route('retros.show', $retro))
        ->and($html)->toContain('Participants (');
});

it('escapes Markdown in the mail', function () {
    [$retro, $facilitator] = emailableRetro();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    $card = Card::factory()->create(['retro_id' => $retro->id, 'column_id' => $column->id, 'content' => '[click me](https://evil.test) <script>alert(1)</script> a -> b & c']);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $html = (string) (new RetroResultsNotification($retro->id))->toMail($facilitator)->render();

    expect($html)->not->toContain('href="https://evil.test"')
        ->not->toContain('<script>alert(1)</script>')
        ->toContain('click me')
        ->toContain('a -&gt; b &amp; c')
        ->not->toContain('&amp;gt;');
});

it('skips members who left before sending', function () {
    [$retro, $facilitator] = emailableRetro();
    $notification = new RetroResultsNotification($retro->id);

    expect($notification->shouldSend($facilitator, 'mail'))->toBeTrue();

    $retro->team->members()->detach($facilitator);

    expect($notification->shouldSend($facilitator, 'mail'))->toBeFalse();

    $retro->delete();

    expect($notification->shouldSend($facilitator, 'mail'))->toBeFalse();
});

it('skips the email when the retro was reopened before sending', function () {
    [$retro, $facilitator] = emailableRetro();
    $notification = new RetroResultsNotification($retro->id);

    $retro->forceFill(['phase' => RetroPhase::Discussing])->save();

    expect($notification->shouldSend($facilitator, 'mail'))->toBeFalse();
});

it('keeps the cooldown free when sending fails', function () {
    [$retro, $facilitator] = emailableRetro();
    Notification::shouldReceive('send')->once()->andThrow(new RuntimeException('Queue is down'));

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertServerError();
    expect(IntegrationDelivery::query()->count())->toBe(0);

    Notification::fake();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted();
});

it('allows one email every ten minutes', function () {
    [$retro, $facilitator] = emailableRetro();
    [$admin] = workspaceAdminParticipant($retro);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertAccepted();
    $this->actingAs($admin)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertTooManyRequests()
        ->assertJson(['message' => 'The results were emailed a few minutes ago.']);

    $this->travel(11)->minutes();

    $this->actingAs($admin)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertAccepted();
});

it('refuses non-sharers, guests and unfinished retros', function () {
    [$retro, $facilitator] = emailableRetro(attributes: ['guest_access_enabled' => true]);
    [$member] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($member)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertForbidden();

    [$discussing, $otherFacilitator] = emailableRetro(RetroPhase::Discussing);

    $this->actingAs($otherFacilitator)
        ->postJson(route('retros.results-email.store', $discussing), ['audience' => 'team'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['audience' => 'Results can be shared once the retrospective is completed.']);
    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'everyone'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('audience');
    Notification::assertNothingSent();
});

it('answers 404 when the mailer does not deliver', function (string $mailer) {
    config(['mail.default' => $mailer]);
    [$retro, $facilitator] = emailableRetro();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertNotFound();
})->with(['log', 'array']);

it('refuses when nobody can receive the results', function () {
    [$retro, $facilitator] = emailableRetro();
    $facilitator->forceFill(['email_verified_at' => null])->save();

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'participants'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['audience' => 'Nobody can receive these results by email.']);
    expect(IntegrationDelivery::query()->count())->toBe(0);
});
