<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\TeamRole;
use App\Models\ActionItem;
use App\Models\Team;

it('refuses an observer action items, comments and completion', function () {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);
    $item = ActionItem::factory()->for($team)->create(['assignee_user_id' => $observer->id]);
    $permissions = resolve(ActionItemPermissions::class);
    $actor = ActionItemActor::forUser($observer);

    expect($permissions->canCreateWithoutRetro($observer, $team))->toBeFalse()
        ->and($permissions->canComment($item, $actor))->toBeFalse()
        ->and($permissions->canComplete($item, $actor))->toBeFalse();
});

it('keeps a member able to do what they did before', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);
    $item = ActionItem::factory()->for($team)->create(['assignee_user_id' => $member->id]);
    $permissions = resolve(ActionItemPermissions::class);
    $actor = ActionItemActor::forUser($member);

    expect($permissions->canCreateWithoutRetro($member, $team))->toBeTrue()
        ->and($permissions->canComment($item, $actor))->toBeTrue()
        ->and($permissions->canComplete($item, $actor))->toBeTrue();
});

it('refuses an observer the edit and the deletion of an item they wrote before becoming observer', function () {
    $team = Team::factory()->create();
    $observer = teamMember($team, TeamRole::Observer);
    $item = ActionItem::factory()->withoutRetro($team, $observer)->create();
    $permissions = resolve(ActionItemPermissions::class);
    $actor = ActionItemActor::forUser($observer);

    expect($permissions->canEdit($item, $actor))->toBeFalse()
        ->and($permissions->canDelete($item, $actor))->toBeFalse();
});

it('lets a workspace admin whose team role reads observer edit and delete any item', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin, ['role' => TeamRole::Observer->value]);
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();
    $permissions = resolve(ActionItemPermissions::class);
    $actor = ActionItemActor::forUser($admin);

    expect($permissions->canEdit($item, $actor))->toBeTrue()
        ->and($permissions->canDelete($item, $actor))->toBeTrue();
});
