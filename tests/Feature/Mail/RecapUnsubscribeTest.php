<?php

use App\Actions\Integrations\RetroResultsRecipients;
use App\Enums\RetroPhase;
use App\Enums\RetroResultsAudience;
use App\Models\Retro;
use App\Models\User;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

it('subscribes every account by default', function () {
    expect(User::factory()->create()->fresh()->recap_emails)->toBeTrue();
});

it('leaves an unsubscribed member out of the recipients and of their count', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);
    $quiet = teamMember($retro->team);
    $quiet->forceFill(['recap_emails' => false])->save();
    $recipients = resolve(RetroResultsRecipients::class);

    expect($recipients->query($retro, RetroResultsAudience::Team)->pluck('id')->all())->toBe([$facilitator->id])
        ->and($recipients->counts($retro)['team'])->toBe(1)
        ->and($recipients->isRecipient($retro, $quiet))->toBeFalse();
});

it('carries the one-click unsubscribe headers and the link in both parts', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);
    $url = URL::signedRoute('recapUnsubscribes.show', ['user' => $facilitator->id]);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    expect($mail->headers()->text)->toBe([
        'List-Unsubscribe' => "<{$url}>",
        'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
    ]);
    $mail->assertSeeInHtml($url, false);
    $mail->assertSeeInText($url);
    $mail->assertSeeInHtml(route('notificationPreferences.edit'), false);
});

it('shows a confirmation page and changes nothing on GET', function () {
    $user = User::factory()->create();

    $this->get(URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/recap-unsubscribe')->where('unsubscribed', false));

    $this->assertGuest();
    expect($user->fresh()->recap_emails)->toBeTrue();
});

it('turns the recap e-mails off on a signed POST without signing anyone in', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->post(URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]), ['List-Unsubscribe' => 'One-Click'])
        ->assertNoContent();

    $this->assertGuest();
    expect($user->fresh())->recap_emails->toBeFalse()->action_item_reminders_by_email->toBeTrue()
        ->and($other->fresh()->recap_emails)->toBeTrue();
});

it('goes back to the confirmation page after the button of the page', function () {
    $user = User::factory()->create();
    $url = URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]);

    $this->post($url)->assertRedirect($url);

    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('unsubscribed', true));
});

it('refuses a missing, tampered or borrowed signature', function (string $method) {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $forged = str_replace($user->id, $other->id, URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]));
    $borrowed = str_replace('reminder-unsubscribe', 'recap-unsubscribe', URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]));

    $this->call($method, route('recapUnsubscribes.show', ['user' => $user->id]))->assertForbidden();
    $this->call($method, $forged)->assertForbidden();
    $this->call($method, $borrowed)->assertForbidden();

    expect($user->fresh()->recap_emails)->toBeTrue()
        ->and($other->fresh()->recap_emails)->toBeTrue();
})->with(['GET', 'POST']);

it('lets the member subscribe again from the settings', function () {
    $user = User::factory()->create();
    $user->forceFill(['recap_emails' => false])->save();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('notificationPreferences.preferences.recap_emails', false));

    $this->actingAs($user)->patch(route('notificationPreferences.update'), [
        'action_item_reminders_by_email' => true,
        'action_item_reminders_in_app' => true,
        'recap_emails' => true,
        'recap_in_app' => true,
    ])->assertSessionHasNoErrors();

    expect($user->fresh()->recap_emails)->toBeTrue();
});
