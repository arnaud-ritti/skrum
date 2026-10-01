<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function discussingRetroWithMember(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create($attributes);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

function actionItemGuestRequest(TestCase $test, Participant $guest): TestCase
{
    return $test->withCookies(retroGuestCookie($guest))->withCredentials();
}

function boardActionItemActor(TestCase $test, string $role, Retro $retro, ActionItem $item, Participant $author): TestCase
{
    $newGuest = fn (): Participant => Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    return match ($role) {
        'author' => $test->actingAs($author->user),
        'facilitator' => $test->actingAs(retroFacilitator($retro)[0]),
        'workspace admin' => $test->actingAs(workspaceAdminParticipant($retro)[0]),
        'member assignee' => $test->actingAs(tap(retroMember($retro)[0], fn (User $user) => $item->update(['assignee_user_id' => $user->id]))),
        'guest assignee' => actionItemGuestRequest($test, tap($newGuest(), fn (Participant $guest) => $item->update(['assignee_participant_id' => $guest->id]))),
        'other member' => $test->actingAs(retroMember($retro)[0]),
        'other guest' => actionItemGuestRequest($test, $newGuest()),
    };
}

it('creates items with priority, due date and assignee', function () {
    [$retro, $user] = discussingRetroWithMember();
    [$assignee] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), [
            'content' => 'Speed up CI',
            'priority' => 'high',
            'due_on' => '2026-10-20',
            'assignee_user_id' => $assignee->id,
        ])
        ->assertCreated()
        ->assertJsonPath('actionItem.priority', 'high')
        ->assertJsonPath('actionItem.dueOn', '2026-10-20')
        ->assertJsonPath('actionItem.status', 'open')
        ->assertJsonPath('actionItem.assignee.kind', 'member')
        ->assertJsonPath('actionItem.assignee.id', $assignee->id)
        ->assertJsonPath('actionItem.createdBy.name', $user->name)
        ->assertJsonPath('actionItem.isMine', true);

    Event::assertDispatched(ActionItemCreated::class);
    Event::assertDispatched(fn (ActionItemSaved $event) => $event->retroId === $retro->id && $event->actionItem['isMine'] === false);
});

it('defaults the priority to medium and accepts past due dates', function () {
    [$retro, $user] = discussingRetroWithMember();

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Clean the backlog', 'due_on' => '2020-01-01'])
        ->assertCreated()
        ->assertJsonPath('actionItem.priority', 'medium')
        ->assertJsonPath('actionItem.isOverdue', true);
});

it('normalizes a member participant sent from the board', function () {
    [$retro, $user] = discussingRetroWithMember();
    [$assignee, $assigneeParticipant] = retroMember($retro);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Pair up', 'assignee_participant_id' => $assigneeParticipant->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.assignee.kind', 'member')
        ->json('actionItem.id');

    expect(ActionItem::find($id)->only(['assignee_user_id', 'assignee_participant_id']))
        ->toBe(['assignee_user_id' => $assignee->id, 'assignee_participant_id' => null]);
});

it('assigns guests of the retro', function () {
    [$retro, $user] = discussingRetroWithMember();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Share notes', 'assignee_participant_id' => $guest->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.assignee', [
            'kind' => 'guest',
            'id' => $guest->id,
            'name' => 'Robin',
            'avatarUrl' => $guest->avatarUrl(),
            'isTeamMember' => false,
        ]);
});

it('validates the fields', function (array $payload, string $field) {
    [$retro, $user] = discussingRetroWithMember();

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Valid', ...$payload])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect(ActionItem::count())->toBe(0);
})->with([
    'empty content' => [['content' => ''], 'content'],
    'long content' => [['content' => str_repeat('a', 501)], 'content'],
    'unknown priority' => [['priority' => 'urgent'], 'priority'],
    'badly formatted date' => [['due_on' => '20/10/2026'], 'due_on'],
    'date too early' => [['due_on' => '1999-12-31'], 'due_on'],
    'date too late' => [['due_on' => '2101-01-01'], 'due_on'],
    'assignee outside the team' => [['assignee_user_id' => '00000000-0000-4000-8000-000000000000'], 'assignee_user_id'],
    'participant of another retro' => [['assignee_participant_id' => '00000000-0000-4000-8000-000000000000'], 'assignee_participant_id'],
]);

it('refuses both assignee fields on the board', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), [
            'content' => 'Both',
            'assignee_user_id' => $user->id,
            'assignee_participant_id' => $guest->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('assignee_user_id');
});

it('completes and reopens idempotently', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);
    $route = route('retros.action-items.update', [$retro, $item]);

    $this->actingAs($user)->patchJson($route, ['status' => 'completed'])->assertOk()->assertJsonPath('actionItem.status', 'completed');
    $completedAt = $item->fresh()->completed_at;
    $this->actingAs($user)->patchJson($route, ['status' => 'completed'])->assertOk()->assertJsonPath('actionItem.status', 'completed');
    expect($item->fresh()->completed_at->equalTo($completedAt))->toBeTrue();
    $this->actingAs($user)->patchJson($route, ['status' => 'open'])->assertOk()->assertJsonPath('actionItem.status', 'open');
    $this->actingAs($user)->patchJson($route, ['status' => 'done'])->assertUnprocessable()->assertJsonValidationErrors('status');

    Event::assertDispatchedTimes(ActionItemCompleted::class, 1);
});

it('ignores the legacy is_done field', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['is_done' => true])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'open');
});

it('edits and deletes items of the author', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['content' => 'Reworded', 'priority' => 'low', 'due_on' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.content', 'Reworded')
        ->assertJsonPath('actionItem.priority', 'low')
        ->assertJsonPath('actionItem.dueOn', null);

    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $item]))->assertNoContent();

    expect(ActionItem::find($item->id))->toBeNull();
    Event::assertDispatched(fn (ActionItemDeleted $event) => $event->actionItemId === $item->id);
});

it('applies the permission matrix on the board', function (string $role, string $action, int $status) {
    [$retro, , $author] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);
    $request = boardActionItemActor($this, $role, $retro, $item, $author);

    $response = match ($action) {
        'edit' => $request->patchJson(route('retros.action-items.update', [$retro, $item]), ['content' => 'Changed']),
        'complete' => $request->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed']),
        'delete' => $request->deleteJson(route('retros.action-items.destroy', [$retro, $item])),
    };

    $response->assertStatus($status);
})->with(function () {
    $matrix = [
        'author' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'facilitator' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'workspace admin' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'member assignee' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'guest assignee' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'other member' => ['edit' => 403, 'complete' => 403, 'delete' => 403],
        'other guest' => ['edit' => 403, 'complete' => 403, 'delete' => 403],
    ];

    foreach ($matrix as $role => $actions) {
        foreach ($actions as $action => $status) {
            yield "{$role} may {$action}: {$status}" => [$role, $action, $status];
        }
    }
});

it('lets guests create items on their board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    actionItemGuestRequest($this, $guest)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'From a guest'])
        ->assertCreated()
        ->assertJsonPath('actionItem.isMine', true);
});

it('keeps other phases closed and completed retros read-only on the board', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroFacilitator($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'X'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed'])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $item]))->assertForbidden();
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Completed]);

it('returns 404 for items of another retro and items without a retro', function () {
    [$retro, $user] = discussingRetroWithMember();
    $teamItem = ActionItem::factory()->withoutRetro($retro->team, $user)->create();

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, ActionItem::factory()->create()]), ['status' => 'completed'])
        ->assertNotFound();
    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $teamItem]), ['status' => 'completed'])
        ->assertNotFound();
});

it('creates action items through the shared action', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $author] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);

    $item = resolve(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($author), ['content' => 'Automate the release'], $theme);

    expect($item->only(['content', 'created_by_participant_id', 'theme_id', 'theme_name']))->toBe([
        'content' => 'Automate the release',
        'created_by_participant_id' => $author->id,
        'theme_id' => $theme->id,
        'theme_name' => 'Release pain',
    ]);
});

it('keeps the theme name of an action item after its theme is removed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'theme_name' => 'Release pain']);

    expect(resolve(PresentActionItem::class)->handle($item->fresh()))->toMatchArray(['themeId' => $theme->id, 'themeName' => 'Release pain']);

    $theme->delete();

    expect(resolve(PresentActionItem::class)->handle($item->fresh()))->toMatchArray(['themeId' => null, 'themeName' => 'Release pain']);
});

it('never lets clients write the theme of an action item', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id]);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'X', 'theme_id' => $theme->id, 'theme_name' => 'Forged'])
        ->assertCreated()
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['theme_id' => $theme->id, 'theme_name' => 'Forged'])
        ->assertOk();

    expect(ActionItem::find($id)->only(['theme_id', 'theme_name']))->toBe(['theme_id' => null, 'theme_name' => null]);
});
