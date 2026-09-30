<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

it('blocks deleting an account that is the last owner of a shared workspace', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember(User::factory()->create(), WorkspaceRole::Member)
        ->create();

    $this->actingAs($owner)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasErrors(['password' => 'Transfer ownership of your workspaces before deleting your account.'])
        ->assertRedirect(route('profile.edit'));

    expect($owner->fresh())->not->toBeNull()
        ->and($workspace->fresh())->not->toBeNull();
});

it('deletes workspaces where the user is the only member together with the account', function () {
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->withMember($owner, WorkspaceRole::Owner)->create();

    $this->actingAs($owner)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    expect($owner->fresh())->toBeNull()
        ->and($workspace->fresh())->toBeNull();
});

it('lets an owner delete their account when another owner remains', function () {
    $owner = User::factory()->create();
    $otherOwner = User::factory()->create();
    $workspace = Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember($otherOwner, WorkspaceRole::Owner)
        ->create();

    $this->actingAs($owner)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasNoErrors();

    expect($owner->fresh())->toBeNull()
        ->and($workspace->fresh())->not->toBeNull()
        ->and($workspace->owners()->sole()->is($otherOwner))->toBeTrue();
});

it('deletes the personal access tokens of a deleted account', function () {
    $user = User::factory()->create();
    $user->createToken('assistant');

    $this->actingAs($user)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertSessionHasNoErrors();

    expect(DB::table('personal_access_tokens')->where('tokenable_id', $user->id)->count())->toBe(0);
});
