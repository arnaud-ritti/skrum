<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\ActionItems\UpdateActionItem;
use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemAssigned;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: ActionItem, 2: ActionItemActor}
 */
function authoredActionItem(RetroPhase $phase = RetroPhase::Discussing): array
{
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $author] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    return [$retro, $item, ActionItemActor::forParticipant($author)];
}

it('creates items on every path and announces each one', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $create = app(CreateActionItem::class);

    $boardItem = $create->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Speed up CI']);
    $promoted = $create->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Automate the release'], $theme);
    $teamItem = $create->handle($retro->team, null, ActionItemActor::forUser($user), ['content' => 'Book the room', 'priority' => 'high', 'due_on' => '2026-10-20']);

    expect($boardItem->only(['team_id', 'retro_id', 'created_by_participant_id', 'created_by_user_id']))->toBe([
        'team_id' => $retro->team_id,
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'created_by_user_id' => $user->id,
    ])
        ->and($boardItem->fresh()->priority)->toBe(ActionItemPriority::Medium)
        ->and($promoted->only(['theme_id', 'theme_name']))->toBe(['theme_id' => $theme->id, 'theme_name' => 'Release pain'])
        ->and($teamItem->only(['retro_id', 'created_by_participant_id', 'created_by_user_id']))->toBe([
            'retro_id' => null,
            'created_by_participant_id' => null,
            'created_by_user_id' => $user->id,
        ])
        ->and($teamItem->fresh()->due_on?->toDateString())->toBe('2026-10-20')
        ->and($teamItem->fresh()->priority)->toBe(ActionItemPriority::High);

    Event::assertDispatchedTimes(ActionItemCreated::class, 3);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('normalizes member participants to users', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $resolve = app(ResolveActionItemAssignee::class);

    expect($resolve->handle($retro->team, $retro, ['assignee_participant_id' => $participant->id]))
        ->toBe(['assignee_user_id' => $user->id, 'assignee_participant_id' => null])
        ->and($resolve->handle($retro->team, $retro, ['assignee_participant_id' => $guest->id]))
        ->toBe(['assignee_user_id' => null, 'assignee_participant_id' => $guest->id])
        ->and($resolve->handle($retro->team, $retro, ['assignee_user_id' => $user->id]))
        ->toBe(['assignee_user_id' => $user->id, 'assignee_participant_id' => null])
        ->and($resolve->handle($retro->team, $retro, ['assignee_user_id' => null]))
        ->toBe(['assignee_user_id' => null, 'assignee_participant_id' => null])
        ->and($resolve->handle($retro->team, $retro, ['content' => 'Unrelated']))->toBeNull();
});

it('refuses assignees outside the team', function (Closure $input, string $message) {
    $retro = Retro::factory()->create();

    expect(fn () => app(ResolveActionItemAssignee::class)->handle($retro->team, $retro, $input($retro)))
        ->toThrow(ValidationException::class, $message);
})->with([
    'admin who is not in the team' => [fn (Retro $retro) => ['assignee_user_id' => workspaceManager($retro->team->workspace)->id], 'The assignee must be a member of this team.'],
    'admin participant who is not in the team' => [fn (Retro $retro) => ['assignee_participant_id' => workspaceAdminParticipant($retro)[1]->id], 'The assignee must be a member of this team.'],
    'participant of another retro' => [fn (Retro $retro) => ['assignee_participant_id' => Participant::factory()->guest()->create()->id], 'The assignee must be a participant of this retrospective.'],
    'unknown user' => [fn (Retro $retro) => ['assignee_user_id' => '00000000-0000-4000-8000-000000000000'], 'The assignee must be a member of this team.'],
]);

it('refuses both assignee fields', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    expect(fn () => app(ResolveActionItemAssignee::class)->handle($retro->team, $retro, [
        'assignee_user_id' => $user->id,
        'assignee_participant_id' => $guest->id,
    ]))->toThrow(ValidationException::class, 'Choose either a team member or a guest as assignee, not both.');
});

it('keeps an assignee who left the team while the assignee is unchanged', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $item = ActionItem::factory()->assignedTo($user)->create(['retro_id' => $retro->id]);
    $retro->team->members()->detach($user);
    $resolve = app(ResolveActionItemAssignee::class);

    expect($resolve->handle($retro->team, $retro, ['assignee_user_id' => $user->id], $item))
        ->toBe(['assignee_user_id' => $user->id, 'assignee_participant_id' => null])
        ->and(fn () => $resolve->handle($retro->team, $retro, ['assignee_user_id' => $user->id]))
        ->toThrow(ValidationException::class, 'The assignee must be a member of this team.');
});

it('announces new assignees only', function () {
    [$retro, $item, $author] = authoredActionItem();
    [$assignee] = retroMember($retro);
    $update = app(UpdateActionItem::class);

    $update->handle($item, $author, ['content' => 'Reworded']);
    $update->handle($item, $author, ['assignee_user_id' => $assignee->id, 'assignee_participant_id' => null]);
    $update->handle($item, $author, ['assignee_user_id' => $assignee->id, 'assignee_participant_id' => null]);
    $update->handle($item, $author, ['assignee_user_id' => null, 'assignee_participant_id' => null]);

    expect($item->fresh()->content)->toBe('Reworded');
    Event::assertDispatchedTimes(ActionItemAssigned::class, 1);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('completes and reopens with the skrum origin', function () {
    [, $item, $author] = authoredActionItem();
    $set = app(SetActionItemStatus::class);

    $set->handle($item, $author, ActionItemStatus::Completed);

    expect($item->fresh()->isCompleted())->toBeTrue();

    $set->handle($item, $author, ActionItemStatus::Open);

    expect($item->fresh()->isCompleted())->toBeFalse();
    Event::assertDispatched(ActionItemCompleted::class, fn (ActionItemCompleted $event) => $event->actionItem->is($item) && $event->origin === ActionItemEventOrigin::Skrum);
    Event::assertDispatched(ActionItemReopened::class, fn (ActionItemReopened $event) => $event->actionItem->is($item) && $event->origin === ActionItemEventOrigin::Skrum);
});

it('treats the current status as a no-op', function () {
    [, $item, $author] = authoredActionItem();
    $item->update(['completed_at' => now()]);

    app(SetActionItemStatus::class)->handle($item, $author, ActionItemStatus::Completed);

    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
    Event::assertNotDispatched(TeamActionItemSaved::class);
});

it('lets the external sync actor bypass permissions', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_locked' => true]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    app(SetActionItemStatus::class)->handle($item, new ExternalSyncActor('jira', 'PROJ-12'), ActionItemStatus::Completed);

    expect($item->fresh()->isCompleted())->toBeTrue();
    Event::assertDispatched(ActionItemCompleted::class, fn (ActionItemCompleted $event) => $event->origin === ActionItemEventOrigin::External);
    Event::assertDispatched(TeamActionItemSaved::class);
});

it('refuses changes by people who may not make them', function () {
    [$retro, $item] = authoredActionItem();
    $stranger = ActionItemActor::forParticipant(retroMember($retro)[1]);

    expect(fn () => app(UpdateActionItem::class)->handle($item, $stranger, ['content' => 'Hijacked']))->toThrow(AuthorizationException::class)
        ->and(fn () => app(SetActionItemStatus::class)->handle($item, $stranger, ActionItemStatus::Completed))->toThrow(AuthorizationException::class)
        ->and(fn () => app(DeleteActionItem::class)->handle($item, $stranger))->toThrow(AuthorizationException::class)
        ->and($item->fresh()->content)->not->toBe('Hijacked');
});

it('applies field and status changes together', function () {
    [$retro, $item, $author] = authoredActionItem();
    [$user, $participant] = retroMember($retro);

    $updated = app(ApplyActionItemChanges::class)->handle($item, $author, [
        'content' => 'Pair on the pipeline',
        'priority' => 'low',
        'assignee_participant_id' => $participant->id,
        'status' => 'completed',
    ]);

    expect($updated->content)->toBe('Pair on the pipeline')
        ->and($updated->priority)->toBe(ActionItemPriority::Low)
        ->and($updated->assignee_user_id)->toBe($user->id)
        ->and($updated->assignee_participant_id)->toBeNull()
        ->and($updated->isCompleted())->toBeTrue();
});

it('deletes items and tells the team', function () {
    [, $item, $author] = authoredActionItem();

    app(DeleteActionItem::class)->handle($item, $author);

    expect(ActionItem::find($item->id))->toBeNull();
    Event::assertDispatched(TeamActionItemDeleted::class, fn (TeamActionItemDeleted $event) => $event->actionItemId === $item->id);
});

it('stores member assignees on create as users and keeps guests as participants', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $actor = ActionItemActor::forParticipant($participant);
    $resolve = app(ResolveActionItemAssignee::class);
    $create = app(CreateActionItem::class);

    $memberItem = $create->handle($retro->team, $retro, $actor, [
        'content' => 'Member task',
        ...$resolve->handle($retro->team, $retro, ['assignee_participant_id' => $participant->id]),
    ]);
    $guestItem = $create->handle($retro->team, $retro, $actor, [
        'content' => 'Guest task',
        ...$resolve->handle($retro->team, $retro, ['assignee_participant_id' => $guest->id]),
    ]);

    expect($memberItem->assignee_user_id)->toBe($user->id)
        ->and($memberItem->assignee_participant_id)->toBeNull()
        ->and($guestItem->assignee_user_id)->toBeNull()
        ->and($guestItem->assignee_participant_id)->toBe($guest->id);
});

it('keeps completed_at when completing an already completed item', function () {
    [, $item, $author] = authoredActionItem();
    $completedAt = now()->subDay()->startOfSecond();
    $item->update(['completed_at' => $completedAt]);

    app(SetActionItemStatus::class)->handle($item, $author, ActionItemStatus::Completed);

    expect($item->fresh()->completed_at->equalTo($completedAt))->toBeTrue();
});
