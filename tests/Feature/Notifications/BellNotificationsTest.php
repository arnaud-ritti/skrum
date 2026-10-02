<?php

use App\Enums\ActionItemReminderKind;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Events\NotificationReceived;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\ActionItemReminderNotification;
use App\Notifications\RetroResultsNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use App\Support\Mail\MailBrand;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
    config(['mail.default' => 'smtp']);
    Mail::fake();
});

/**
 * @return array<int, array<string, mixed>>
 */
function bellOf(User $user): array
{
    return test()->actingAs($user)->getJson(route('notifications.index'))->assertOk()->json('notifications');
}

/**
 * @return array{0: User, 1: WorkspaceInvitation, 2: string, 3: User}
 */
function invitedThroughTheBell(string $token = 'bell-invitation-token'): array
{
    $inviter = User::factory()->create(['name' => 'Ada Inviter']);
    $workspace = Workspace::factory()->withMember($inviter, WorkspaceRole::Admin)->create(['name' => 'Acme']);
    $invited = User::factory()->create(['email' => 'known@example.test']);
    $invitation = WorkspaceInvitation::factory()->withToken($token)->create([
        'workspace_id' => $workspace->id,
        'email' => 'known@example.test',
        'invited_by_id' => $inviter->id,
    ]);
    $invited->notify(new WorkspaceInvitationReceivedNotification($invitation->id, route('invitations.show', $token)));

    return [$invited, $invitation, $token, $inviter];
}

/**
 * @return array{0: User, 1: ActionItem}
 */
function remindedThroughTheBell(): array
{
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-08']);
    $user->notify(new ActionItemReminderNotification($item->id, ActionItemReminderKind::Overdue, $team->workspace_id, '2026-10-08'));

    return [$user, $item];
}

function inviteByForm(User $admin, Workspace $workspace, string $email): TestResponse
{
    return test()->actingAs($admin)
        ->from(route('workspaces.show', $workspace))
        ->post(route('workspaces.invitations.store', $workspace), ['email' => $email, 'role' => 'member']);
}

it('lists a recap for each recipient of the recap mail and for nobody else', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42']);
    [$facilitator, $facilitatorParticipant] = retroFacilitator($retro);
    $recipient = teamMember($team);
    $unsubscribed = teamMember($team);
    $unsubscribed->forceFill(['recap_emails' => false])->save();
    Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $outsider = teamMember(Team::factory()->for($team->workspace)->create());
    ActionItem::factory()->count(4)->create(['retro_id' => $retro->id]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $facilitatorParticipant->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 4]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => 3]);

    $this->actingAs($facilitator)
        ->postJson(route('retros.results-email.store', $retro), ['audience' => 'team'])
        ->assertAccepted();

    expect(DB::table('notifications')->where('data->kind', 'recap_ready')->pluck('notifiable_id')->sort()->values()->all())
        ->toBe(collect([$facilitator->id, $recipient->id])->sort()->values()->all())
        ->and(bellOf($unsubscribed))->toBe([])
        ->and(bellOf($outsider))->toBe([]);

    $recap = bellOf($recipient)[0];

    expect($recap)->toMatchArray([
        'kind' => 'recap_ready',
        'readAt' => null,
        'team' => 'Atlas',
        'session' => ['id' => $retro->id, 'title' => 'Sprint 42'],
        'actionsCount' => 4,
        'roti' => 3.7,
        'href' => route('retros.show', $retro),
    ])->and(array_keys($recap))->toBe(['id', 'kind', 'readAt', 'createdAt', 'team', 'session', 'actionsCount', 'roti', 'href']);
});

it('hides the ROTI of a recap under three votes', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);
    RotiVote::factory()->count(2)->create(['retro_id' => $retro->id, 'score' => 5]);
    $facilitator->notify(new RetroResultsNotification($retro->id));

    expect(bellOf($facilitator)[0]['roti'])->toBeNull();
});

it('notifies the one verified account that owns the invited address', function () {
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->withMember($admin, WorkspaceRole::Admin)->create(['name' => 'Acme']);
    $known = User::factory()->create(['email' => 'known@example.test']);
    $unverified = User::factory()->unverified()->create(['email' => 'unverified@example.test']);
    $twins = [
        User::factory()->create(['email' => 'twin@example.test']),
        User::factory()->create(['email' => 'Twin@example.test']),
    ];

    $answers = collect([' Known@Example.test', 'unknown@example.test', 'unverified@example.test', 'twin@example.test'])
        ->map(function (string $email) use ($admin, $workspace): array {
            $response = inviteByForm($admin, $workspace, $email)->assertSessionHasNoErrors();

            return [$response->status(), $response->headers->get('Location'), array_keys((array) session()->get('_flash.new'))];
        });

    expect($answers->unique()->count())->toBe(1)
        ->and($answers[0][0])->toBe(302)
        ->and($workspace->invitations()->count())->toBe(4)
        ->and(DB::table('notifications')->pluck('notifiable_id')->all())->toBe([$known->id])
        ->and($unverified->notifications()->count())->toBe(0)
        ->and($twins[0]->notifications()->count() + $twins[1]->notifications()->count())->toBe(0);

    $notification = bellOf($known)[0];

    expect($notification)->toMatchArray([
        'kind' => 'team_invite',
        'readAt' => null,
        'actor' => ['name' => $admin->name, 'presence' => MailBrand::presence($admin->avatarSeed()), 'avatarUrl' => $admin->avatarUrl()],
        'team' => 'Acme',
    ])->and(array_keys($notification))->toBe(['id', 'kind', 'readAt', 'createdAt', 'actor', 'team', 'href']);
});

it('stores the invitation link encrypted and gives it to its owner only', function () {
    [$invited, $invitation, $token] = invitedThroughTheBell();
    $stored = (string) DB::table('notifications')->where('notifiable_id', $invited->id)->value('data');

    expect($stored)->not->toContain($token)
        ->and($stored)->not->toContain('invitations')
        ->and(json_decode($stored, true)['invitationId'])->toBe($invitation->id)
        ->and(bellOf($invited)[0]['href'])->toBe(route('invitations.show', $token))
        ->and(bellOf(User::factory()->create()))->toBe([])
        ->and(bellOf($invitation->invitedBy))->toBe([]);
});

it('links an invitation notification to the invitation page and accepts nothing', function () {
    [$invited, $invitation, $token] = invitedThroughTheBell();
    $notification = bellOf($invited)[0];

    $this->actingAs($invited)->patchJson(route('notifications.update', $notification['id']), ['read' => true])->assertOk();

    expect($invitation->fresh()->isPending())->toBeTrue()
        ->and($invited->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and(Route::has('receivedInvitations.acceptance.store'))->toBeFalse();

    $this->actingAs($invited)->get($notification['href'])
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('invitations/show')->where('emailMatches', true));

    expect($invitation->fresh()->isPending())->toBeTrue();

    $this->actingAs($invited)->post(route('invitations.acceptance.store', $token))->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($invited->fresh()->belongsToWorkspace($invitation->workspace))->toBeTrue();
});

it('drops a notification whose subject is out of reach', function (Closure $putOutOfReach) {
    [$invited, $invitation] = invitedThroughTheBell();
    $team = Team::factory()->create();
    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create();
    $team->workspace->members()->attach($invited, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($invited);
    $invited->notify(new RetroResultsNotification($retro->id));

    expect(bellOf($invited))->toHaveCount(2);

    $putOutOfReach($invitation, $invited);
    $team->members()->detach($invited);

    $this->actingAs($invited)->getJson(route('notifications.index'))
        ->assertOk()
        ->assertExactJson(['notifications' => [], 'unreadCount' => 0, 'hasMore' => false]);

    expect($invited->notifications()->count())->toBe(0);
})->with([
    'revoked' => [fn (WorkspaceInvitation $invitation) => $invitation->delete()],
    'expired' => [fn (WorkspaceInvitation $invitation) => $invitation->forceFill(['expires_at' => now()->subMinute()])->save()],
    'accepted' => [fn (WorkspaceInvitation $invitation) => $invitation->forceFill(['accepted_at' => now()])->save()],
    'no longer the invited address' => [fn (WorkspaceInvitation $invitation, User $invited) => $invited->forceFill(['email' => 'moved@example.test'])->save()],
    'link that no longer decrypts' => [fn (WorkspaceInvitation $invitation, User $invited) => $invited->notifications()
        ->where('data->kind', 'team_invite')
        ->update(['data' => json_encode(['kind' => 'team_invite', 'invitationId' => $invitation->id, 'link' => 'not-a-cipher'])])],
]);

it('gives the ticket key of an action item that has an external link', function () {
    [$user, $item] = remindedThroughTheBell();

    expect(bellOf($user)[0]['actionItem']['ticket'])->toBeNull();

    ActionItemExternalLink::factory()->create(['action_item_id' => $item->id, 'external_key' => 'ATLAS-1287']);

    expect(bellOf($user)[0]['actionItem']['ticket'])->toBe('ATLAS-1287');
});

it('pages by twenty and says when there is more', function () {
    [$user, $item] = remindedThroughTheBell();
    [$other] = remindedThroughTheBell();

    foreach (range(1, 44) as $ignored) {
        $user->notify(new ActionItemReminderNotification($item->id, ActionItemReminderKind::Overdue, $item->team->workspace_id, '2026-10-08'));
    }

    $page = fn (?string $before): TestResponse => $this->actingAs($user)->getJson(route('notifications.index', array_filter(['before' => $before])))->assertOk();

    $first = $page(null)->assertJsonCount(20, 'notifications')->assertJsonPath('hasMore', true)->assertJsonPath('unreadCount', 45);
    $second = $page($first->json('notifications.19.id'))->assertJsonCount(20, 'notifications')->assertJsonPath('hasMore', true);
    $third = $page($second->json('notifications.19.id'))->assertJsonCount(5, 'notifications')->assertJsonPath('hasMore', false);

    expect(collect([$first, $second, $third])->flatMap(fn (TestResponse $response) => $response->json('notifications.*.id'))->unique()->count())->toBe(45);

    $this->actingAs($user)->getJson(route('notifications.index', ['before' => $other->notifications()->sole()->id]))->assertNotFound();
    $this->actingAs($user)->getJson(route('notifications.index', ['before' => 'not-a-uuid']))->assertUnprocessable();
});

it('tells the open page that a notification arrived, with a count only', function () {
    Event::fake([NotificationReceived::class]);
    [$user] = remindedThroughTheBell();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    $retro->team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $retro->team->members()->attach($user);
    $invitation = WorkspaceInvitation::factory()->withToken('another-token')->create(['email' => $user->email]);

    $user->notify(new RetroResultsNotification($retro->id));
    $user->notify(new WorkspaceInvitationReceivedNotification($invitation->id, route('invitations.show', 'another-token')));

    Event::assertDispatchedTimes(NotificationReceived::class, 3);

    foreach ([1, 2, 3] as $count) {
        Event::assertDispatched(fn (NotificationReceived $event): bool => $event->broadcastOn()->name === "private-user.{$user->id}"
            && $event->broadcastAs() === 'notification.received'
            && $event->broadcastWith() === ['unreadCount' => $count]);
    }
});

it('authorises the user channel for its owner only', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    $user = User::factory()->create();
    $other = User::factory()->create();
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $channel = fn (string $id): array => ['socket_id' => '1234.5678', 'channel_name' => "private-user.{$id}"];

    $this->postJson(route('broadcasting.auth'), $channel($user->id))->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->postJson(route('broadcasting.auth'), $channel($user->id))->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->postJson(route('broadcasting.auth'), $channel($guest->id))->assertForbidden();

    $response = $this->actingAs($user)->postJson(route('broadcasting.auth'), $channel($user->id))->assertOk();

    expect($response->json('auth'))->toStartWith('test-key:');

    $this->actingAs($user)->postJson(route('broadcasting.auth'), $channel($other->id))->assertForbidden();
    $this->actingAs($user)->postJson(route('broadcasting.auth'), $channel("{$user->id}.extra"))->assertForbidden();
});
