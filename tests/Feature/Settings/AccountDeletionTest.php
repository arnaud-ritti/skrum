<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\SqlProbe;

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

it('deletes an account created by single sign-on without asking for a password its owner never set', function () {
    $user = User::factory()->create(['password' => Str::password(64), 'password_set_at' => null]);

    $this->actingAs($user)
        ->delete(route('profile.destroy'))
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('home'));

    expect($user->fresh())->toBeNull();
});

it('still asks for the current password of an account that set one', function (?string $password) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), ['password' => $password])
        ->assertSessionHasErrors('password');

    expect($user->fresh())->not->toBeNull();
})->with([
    'missing' => [null],
    'wrong' => ['wrong-password'],
]);

it('keeps the workspace ownership check for an account created by single sign-on', function () {
    $owner = User::factory()->create(['password_set_at' => null]);
    Workspace::factory()
        ->withMember($owner, WorkspaceRole::Owner)
        ->withMember(User::factory()->create(), WorkspaceRole::Member)
        ->create();

    $this->actingAs($owner)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'))
        ->assertSessionHasErrors(['password' => 'Transfer ownership of your workspaces before deleting your account.']);

    expect($owner->fresh())->not->toBeNull();
});

it('keeps the person signed in when the deletion fails and rolls back', function () {
    $user = User::factory()->create();
    Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create();
    Workspace::deleting(fn () => throw new RuntimeException('Storage down'));

    $this->actingAs($user)
        ->delete(route('profile.destroy'), ['password' => 'password'])
        ->assertServerError();

    expect($user->fresh())->not->toBeNull();
    $this->assertAuthenticatedAs($user);
});

it('locks the workspaces of the account inside the deletion before it checks their owners', function () {
    $user = User::factory()->create();
    Workspace::factory()->withMember($user, WorkspaceRole::Owner)->withMember(User::factory()->create(), WorkspaceRole::Owner)->create();
    $levelOutside = DB::transactionLevel();

    $locks = SqlProbe::locks(fn () => $this->actingAs($user)->delete(route('profile.destroy'), ['password' => 'password'])->assertSessionHasNoErrors());

    expect($locks)->toContain(['table' => 'workspaces', 'level' => $levelOutside + 1]);
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');
