<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * @return array{retro: Retro, item: ActionItem, author: Participant}
 */
function permissionsFixture(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    [, $author] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    return ['retro' => $retro, 'item' => $item, 'author' => $author];
}

it('decides who manages, completes and comments on board items', function (Closure $makeActor, bool $manages, bool $completes) {
    $fixture = permissionsFixture();
    $actor = $makeActor($fixture);
    $item = $fixture['item']->fresh();
    $permissions = resolve(ActionItemPermissions::class);

    expect($permissions->canEdit($item, $actor))->toBe($manages)
        ->and($permissions->canDelete($item, $actor))->toBe($manages)
        ->and($permissions->canComplete($item, $actor))->toBe($completes)
        ->and($permissions->canComment($item, $actor))->toBeTrue();
})->with([
    'author on the board' => [fn (array $fixture) => ActionItemActor::forParticipant($fixture['author']), true, true],
    'author on the global page' => [fn (array $fixture) => ActionItemActor::forUser($fixture['author']->user), true, true],
    'facilitator on the board' => [fn (array $fixture) => ActionItemActor::forParticipant(retroFacilitator($fixture['retro'])[1]), true, true],
    'facilitator on the global page' => [fn (array $fixture) => ActionItemActor::forUser(retroFacilitator($fixture['retro'])[0]), true, true],
    'workspace admin' => [fn (array $fixture) => ActionItemActor::forUser(workspaceManager($fixture['retro']->team->workspace)), true, true],
    'workspace owner' => [fn (array $fixture) => ActionItemActor::forUser(workspaceManager($fixture['retro']->team->workspace, WorkspaceRole::Owner)), true, true],
    'member assignee' => [function (array $fixture): ActionItemActor {
        [$user, $participant] = retroMember($fixture['retro']);
        $fixture['item']->update(['assignee_user_id' => $user->id]);

        return ActionItemActor::forParticipant($participant);
    }, false, true],
    'guest assignee' => [function (array $fixture): ActionItemActor {
        $guest = Participant::factory()->guest()->create(['retro_id' => $fixture['retro']->id]);
        $fixture['item']->update(['assignee_participant_id' => $guest->id]);

        return ActionItemActor::forParticipant($guest);
    }, false, true],
    'other member' => [fn (array $fixture) => ActionItemActor::forParticipant(retroMember($fixture['retro'])[1]), false, false],
    'other guest' => [fn (array $fixture) => ActionItemActor::forParticipant(Participant::factory()->guest()->create(['retro_id' => $fixture['retro']->id])), false, false],
]);

it('lets the facilitator of a running retro of the team complete earlier items', function () {
    $fixture = permissionsFixture();
    $fixture['retro']->update(['phase' => RetroPhase::Completed]);
    $next = Retro::factory()->create(['team_id' => $fixture['retro']->team_id]);
    [$user, $participant] = retroFacilitator($next);
    $elsewhere = Retro::factory()->create();
    [$strangerUser] = retroFacilitator($elsewhere);
    $item = $fixture['item']->fresh();
    $permissions = resolve(ActionItemPermissions::class);

    expect($permissions->canComplete($item, ActionItemActor::forParticipant($participant)))->toBeTrue()
        ->and($permissions->canComplete($item, ActionItemActor::forUser($user)))->toBeTrue()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($user)))->toBeFalse()
        ->and($permissions->canComplete($item, ActionItemActor::forUser($strangerUser)))->toBeFalse();

    $next->update(['phase' => RetroPhase::Completed]);

    expect($permissions->canComplete($item, ActionItemActor::forUser($user)))->toBeFalse();
});

it('keeps items without a retro to their author and workspace admins', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $other = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create();
    $permissions = resolve(ActionItemPermissions::class);

    expect($permissions->canCreateWithoutRetro($other, $team))->toBeTrue()
        ->and($permissions->canCreateWithoutRetro($admin, $team))->toBeFalse()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($author)))->toBeTrue()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($admin)))->toBeTrue()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($other)))->toBeFalse()
        ->and($permissions->canComplete($item, ActionItemActor::forUser($other)))->toBeFalse()
        ->and($permissions->canComment($item, ActionItemActor::forUser($other)))->toBeTrue()
        ->and($permissions->canComment($item, ActionItemActor::forUser(teamMember(Team::factory()->create()))))->toBeFalse();

    $item->update(['assignee_user_id' => $other->id]);

    expect($permissions->canComplete($item->fresh(), ActionItemActor::forUser($other)))->toBeTrue();
});

it('lets comment authors edit and managers delete comments', function () {
    $fixture = permissionsFixture();
    [$memberUser, $member] = retroMember($fixture['retro']);
    $comment = ActionItemComment::factory()->byParticipant($member)->create(['action_item_id' => $fixture['item']->id]);
    $permissions = resolve(ActionItemPermissions::class);

    expect($permissions->canEditComment($comment, ActionItemActor::forParticipant($member)))->toBeTrue()
        ->and($permissions->canEditComment($comment, ActionItemActor::forUser($memberUser)))->toBeTrue()
        ->and($permissions->canEditComment($comment, ActionItemActor::forParticipant($fixture['author'])))->toBeFalse()
        ->and($permissions->canDeleteComment($comment, ActionItemActor::forParticipant($fixture['author'])))->toBeTrue()
        ->and($permissions->canDeleteComment($comment, ActionItemActor::forParticipant(retroMember($fixture['retro'])[1])))->toBeFalse();
});

it('explains refusals', function () {
    $fixture = permissionsFixture();
    $stranger = ActionItemActor::forParticipant(retroMember($fixture['retro'])[1]);
    $team = $fixture['retro']->team;
    $permissions = resolve(ActionItemPermissions::class);

    expect(fn () => $permissions->authorizeEdit($fixture['item'], $stranger))
        ->toThrow(AuthorizationException::class, 'Only the author, the facilitator or an admin can change this action item.')
        ->and(fn () => $permissions->authorizeComplete($fixture['item'], $stranger))
        ->toThrow(AuthorizationException::class, 'Only the assignee or a manager can complete this action item.')
        ->and(fn () => $permissions->authorizeCreateWithoutRetro(workspaceManager($team->workspace), $team))
        ->toThrow(AuthorizationException::class, 'Only team members can add action items to this team.');
});
