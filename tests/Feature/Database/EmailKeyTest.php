<?php

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Actions\Workspaces\InvitationTerms;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Rules\UniqueEmailAddress;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

function legacyTwin(User $user, string $storedAddress): User
{
    $twin = User::factory()->create();
    DB::table('users')->where('id', $twin->id)->update(['email' => $storedAddress, 'email_key' => $user->email_key]);

    return $twin->fresh();
}

it('stores the key of an address whenever the address is set', function () {
    $user = User::factory()->create(['email' => '  Ada@Example.TEST ']);

    expect($user->fresh()->email)->toBe('ada@example.test')
        ->and($user->fresh()->email_key)->toBe('ada@example.test');

    $user->update(['email' => 'Grace@Example.TEST']);

    expect($user->fresh()->email_key)->toBe('grace@example.test');
});

it('stores the key when model events are faked', function () {
    Event::fake();

    $user = User::factory()->create(['email' => 'Ada@Example.TEST']);

    expect($user->fresh()->email_key)->toBe('ada@example.test');
});

it('has an index on the key', function () {
    expect(Schema::hasIndex('users', ['email_key']))->toBeTrue();
});

it('refuses an account written without its key', function () {
    $write = fn () => DB::table('users')->insert(['id' => (string) Str::uuid7(), 'name' => 'Ada', 'email' => 'ada@example.test', 'password' => 'secret']);

    expect($write)->toThrow(QueryException::class);
});

it('finds an account by its address in any case', function (string $typed) {
    $user = User::factory()->create(['email' => 'ada@example.test']);

    expect(User::query()->whereAddress($typed)->sole()->id)->toBe($user->id);
})->with(['ada@example.test', 'ADA@EXAMPLE.TEST', ' Ada@Example.test ']);

it('finds both accounts when a legacy row shares the address once normalised', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);
    legacyTwin($user, 'ADA@example.test');

    expect(User::query()->whereAddress('Ada@example.test')->count())->toBe(2);
});

it('gives a legacy row built by the factory the key of its address', function () {
    $user = User::factory()->storedWithAddress('ADA@Example.test')->create();

    expect($user->fresh()->email)->toBe('ADA@Example.test')
        ->and($user->fresh()->email_key)->toBe('ada@example.test')
        ->and(User::query()->whereAddress('ada@example.test')->sole()->id)->toBe($user->id);
});

it('refuses a new account on an address a legacy row uses', function () {
    $user = User::factory()->create(['email' => 'ada@example.test']);
    DB::table('users')->where('id', $user->id)->update(['email' => 'ADA@example.test']);

    $validator = Validator::make(['email' => 'ada@example.test'], ['email' => [new UniqueEmailAddress]]);

    expect($validator->fails())->toBeTrue();
});

it('stores an invitation address normalised and replaces a pending one whatever its case', function () {
    $workspace = Workspace::factory()->create();
    $invitation = WorkspaceInvitation::factory()->create(['workspace_id' => $workspace->id, 'email' => 'Bob@Example.TEST']);

    expect($invitation->fresh()->email)->toBe('bob@example.test');

    resolve(CreateWorkspaceInvitation::class)->handle($workspace, workspaceManager($workspace), new InvitationTerms('BOB@example.test', WorkspaceRole::Member));

    expect($workspace->invitations()->whereNull('accepted_at')->count())->toBe(1);
});

it('gives the password broker the same answer on every engine for a mixed-case address', function () {
    User::factory()->create(['email' => 'ada@example.test']);

    $found = Password::broker()->getUser(['email' => 'ADA@Example.test']);

    expect($found)->toBeNull();
});
