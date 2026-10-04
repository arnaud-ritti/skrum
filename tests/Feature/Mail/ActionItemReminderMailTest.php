<?php

use App\Enums\ActionItemReminderKind;
use App\Mail\ActionItemReminderMail;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

function reminderMailFor(User $user, ActionItem ...$items): ActionItemReminderMail
{
    return new ActionItemReminderDigestNotification(array_map(
        fn (ActionItem $item): array => ['actionItemId' => $item->id, 'kind' => ActionItemReminderKind::Overdue->value],
        $items,
    ))->toMail($user);
}

it('returns the branded mailable with one-click unsubscribe headers', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-01']);

    $mail = reminderMailFor($user, $item);
    $unsubscribeUrl = URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]);

    expect($mail->hasTo($user->email))->toBeTrue()
        ->and($mail->headers()->text)->toBe([
            'List-Unsubscribe' => "<{$unsubscribeUrl}>",
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    $mail->assertSeeInHtml($unsubscribeUrl, false);
});

it('escapes item text and keeps it on one line', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['content' => "Fix <b> & it.\nnext [line](https://evil.test)", 'due_on' => '2026-10-01']);

    $html = (string) reminderMailFor($user, $item)->render();

    expect($html)->toContain('Fix &lt;b&gt; &amp; it. next')
        ->not->toContain('href="https://evil.test"')
        ->not->toContain('&amp;lt;');
});

it('says how many items are left out beyond the limit', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->count(ActionItemReminderDigestNotification::Limit + 3)->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-01']);

    reminderMailFor($user, ...$items->all())->assertSeeInHtml('And 3 more.');
});

it('shows a confirmation page and changes nothing on GET', function () {
    $user = User::factory()->create();

    $this->get(URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/reminder-unsubscribe')->where('unsubscribed', false));

    $this->assertGuest();
    expect($user->fresh()->action_item_reminders_by_email)->toBeTrue();
});

it('turns the e-mail reminders off on a signed POST without signing anyone in', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->post(URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]), ['List-Unsubscribe' => 'One-Click'])
        ->assertNoContent();

    $this->assertGuest();
    expect($user->fresh())->action_item_reminders_by_email->toBeFalse()->action_item_reminders_in_app->toBeTrue()
        ->and($other->fresh()->action_item_reminders_by_email)->toBeTrue();
});

it('refuses a missing or tampered signature', function (string $method) {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $forged = str_replace($user->id, $other->id, URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]));

    $this->call($method, route('reminderUnsubscribes.show', ['user' => $user->id]))->assertForbidden();
    $this->call($method, $forged)->assertForbidden();

    expect($other->fresh()->action_item_reminders_by_email)->toBeTrue();
})->with(['GET', 'POST']);
