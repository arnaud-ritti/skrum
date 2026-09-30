<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Notifications\ActionItemReminderDigestNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @param  array<int, array{0: ActionItem, 1: ActionItemReminderKind}>  $entries
 */
function reminderDigest(array $entries): ActionItemReminderDigestNotification
{
    return new ActionItemReminderDigestNotification(array_map(
        fn (array $entry) => ['actionItemId' => $entry[0]->id, 'kind' => $entry[1]->value],
        $entries,
    ));
}

it('lists overdue items before items due soon, each with its context and link', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id, 'title' => 'Sprint 42']);
    $overdue = ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Rotate the keys', 'due_on' => '2026-10-07']);
    $today = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Book the room', 'due_on' => '2026-10-10']);
    $tomorrow = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Send the notes', 'due_on' => '2026-10-11']);

    $mail = reminderDigest([
        [$today, ActionItemReminderKind::DueSoon],
        [$overdue, ActionItemReminderKind::Overdue],
        [$tomorrow, ActionItemReminderKind::DueSoon],
    ])->toMail($user);
    $html = (string) $mail->render();

    expect($mail->subject)->toBe('Action items need your attention')
        ->and(strpos($html, 'Rotate the keys'))->toBeLessThan(strpos($html, 'Book the room'))
        ->and($html)->toContain('Platform')
        ->toContain('Sprint 42')
        ->toContain('Added outside a retro')
        ->toContain('Due today')
        ->toContain('Due tomorrow')
        ->toContain('October 7, 2026')
        ->toContain(e(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $overdue->id])))
        ->toContain('View my open action items')
        ->toContain(e(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'assignee' => 'me', 'status' => 'open'])))
        ->toContain('You can turn off these reminders in your notification settings.')
        ->toContain(route('notificationPreferences.edit'));
});

it('shows at most twenty items and counts the rest', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->count(23)->withoutRetro($team, $user)->create(['due_on' => '2026-10-11']);

    $html = (string) reminderDigest($items->map(fn (ActionItem $item) => [$item, ActionItemReminderKind::DueSoon])->all())
        ->toMail($user)
        ->render();

    expect(substr_count($html, '?item='))->toBe(20)
        ->and($html)->toContain('And 3 more.');
});

it('uses singular and plural subjects', function (int $overdue, int $dueSoon, string $subject) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $entries = [
        ...ActionItem::factory()->count($overdue)->withoutRetro($team, $user)->create(['due_on' => '2026-10-08'])
            ->map(fn (ActionItem $item) => [$item, ActionItemReminderKind::Overdue])->all(),
        ...ActionItem::factory()->count($dueSoon)->withoutRetro($team, $user)->create(['due_on' => '2026-10-11'])
            ->map(fn (ActionItem $item) => [$item, ActionItemReminderKind::DueSoon])->all(),
    ];

    expect(reminderDigest($entries)->toMail($user)->subject)->toBe($subject);
})->with([
    'one overdue' => [1, 0, '1 action item is overdue'],
    'two overdue' => [2, 0, '2 action items are overdue'],
    'one due soon' => [0, 1, '1 action item is due soon'],
    'three due soon' => [0, 3, '3 action items are due soon'],
]);

it('leaves out items deleted before the mail is written', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $kept = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Still here', 'due_on' => '2026-10-11']);
    $gone = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Already gone', 'due_on' => '2026-10-11']);
    $digest = reminderDigest([[$kept, ActionItemReminderKind::DueSoon], [$gone, ActionItemReminderKind::DueSoon]]);

    $gone->delete();
    $mail = $digest->toMail($user);

    expect($mail->subject)->toBe('1 action item is due soon')
        ->and((string) $mail->render())->toContain('Still here')->not->toContain('Already gone');
});

it('escapes item text so it cannot inject links', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Click [here](https://evil.test)', 'due_on' => '2026-10-11']);

    $html = (string) reminderDigest([[$item, ActionItemReminderKind::DueSoon]])->toMail($user)->render();

    expect($html)->not->toContain('href="https://evil.test"');
});

it('writes the digest in the recipient language', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->update(['locale' => 'fr']);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-07']);
    Notification::fake();

    $user->notify(reminderDigest([[$item, ActionItemReminderKind::Overdue]]));

    Notification::assertSentTo(
        $user,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification, array $channels, object $notifiable, ?string $locale) => $locale === 'fr' && $channels === ['mail'],
    );

    app()->setLocale('fr');
    $mail = reminderDigest([[$item, ActionItemReminderKind::Overdue]])->toMail($user);

    expect($mail->subject)->toBe('1 action est en retard')
        ->and((string) $mail->render())->toContain('7 octobre 2026');
});
