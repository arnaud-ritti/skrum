<?php

use App\Actions\Admin\RevokeInstanceAdmin;
use App\Http\Controllers\Admin\AdminCandidatesController;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use Tests\Support\SqlProbe;

function actingAsInstanceAdmin(mixed $test, array $attributes = []): User
{
    $admin = User::factory()->instanceAdmin()->create($attributes);

    $test->actingAs($admin)->withSession(['auth.password_confirmed_at' => time()]);

    return $admin;
}

it('lists the instance admins by name and marks the signed-in one', function () {
    $admin = actingAsInstanceAdmin($this, ['name' => 'Zoe']);
    $other = User::factory()->instanceAdmin()->create(['name' => 'Adam']);
    User::factory()->create(['name' => 'Member']);

    $this->get(route('admin.admins.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('admin/admins')
            ->where('admins', [
                [
                    'id' => $other->id,
                    'name' => 'Adam',
                    'email' => $other->email,
                    'avatarUrl' => $other->avatarUrl(),
                    'isSelf' => false,
                    'canRevoke' => true,
                ],
                [
                    'id' => $admin->id,
                    'name' => 'Zoe',
                    'email' => $admin->email,
                    'avatarUrl' => $admin->avatarUrl(),
                    'isSelf' => true,
                    'canRevoke' => true,
                ],
            ]));
});

it('does not offer to revoke the last admin', function () {
    actingAsInstanceAdmin($this);

    $this->get(route('admin.admins.index'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->has('admins', 1)
            ->where('admins.0.isSelf', true)
            ->where('admins.0.canRevoke', false));
});

it('grants the admin flag to a user', function () {
    actingAsInstanceAdmin($this);
    $member = User::factory()->create();

    $this->post(route('admin.admins.store'), ['user_id' => $member->id])
        ->assertRedirect(route('admin.admins.index'))
        ->assertInertiaFlash('toast.type', 'success');

    expect($member->fresh()->is_instance_admin)->toBeTrue();
});

it('grants twice without error', function () {
    actingAsInstanceAdmin($this);
    $member = User::factory()->create();

    $this->post(route('admin.admins.store'), ['user_id' => $member->id])->assertRedirect();
    $this->post(route('admin.admins.store'), ['user_id' => $member->id])->assertRedirect()->assertSessionHasNoErrors();

    expect($member->fresh()->is_instance_admin)->toBeTrue()
        ->and(User::query()->where('is_instance_admin', true)->count())->toBe(2);
});

it('refuses to grant to an unknown or malformed user id', function (mixed $userId) {
    actingAsInstanceAdmin($this);

    $this->postJson(route('admin.admins.store'), ['user_id' => $userId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('user_id');
})->with([
    'missing' => [null],
    'not a uuid' => ['1 or 1=1'],
    'unknown uuid' => ['0198a3a0-0000-7000-8000-000000000000'],
]);

it('revokes another admin', function () {
    actingAsInstanceAdmin($this);
    $other = User::factory()->instanceAdmin()->create();

    $this->delete(route('admin.admins.destroy', $other))
        ->assertRedirect(route('admin.admins.index'))
        ->assertSessionHasNoErrors();

    expect($other->fresh()->is_instance_admin)->toBeFalse();
});

it('refuses to revoke the last admin with a 422 and a translated message', function () {
    $admin = actingAsInstanceAdmin($this);

    $this->deleteJson(route('admin.admins.destroy', $admin))
        ->assertUnprocessable()
        ->assertJsonPath('errors.user.0', 'An instance needs at least one admin.');

    expect($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('reports the refusal as a form error to an Inertia visit', function () {
    $admin = actingAsInstanceAdmin($this);

    $this->from(route('admin.admins.index'))
        ->delete(route('admin.admins.destroy', $admin))
        ->assertRedirect(route('admin.admins.index'))
        ->assertSessionHasErrors(['user' => 'An instance needs at least one admin.']);

    expect($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('translates the refusal', function () {
    $admin = actingAsInstanceAdmin($this, ['locale' => 'fr']);

    $message = $this->deleteJson(route('admin.admins.destroy', $admin))
        ->assertUnprocessable()
        ->json('errors.user.0');

    expect($message)->toBe(trans('An instance needs at least one admin.', [], 'fr'))
        ->not->toBe('An instance needs at least one admin.');
});

it('lets an admin revoke themselves when another admin exists', function () {
    $admin = actingAsInstanceAdmin($this);
    $other = User::factory()->instanceAdmin()->create();

    $this->delete(route('admin.admins.destroy', $admin))
        ->assertRedirect(route('dashboard'))
        ->assertSessionHasNoErrors();

    expect($admin->fresh()->is_instance_admin)->toBeFalse()
        ->and($other->fresh()->is_instance_admin)->toBeTrue();

    $this->actingAs($admin->fresh())->get(route('admin.admins.index'))->assertForbidden();
});

it('refuses to revoke the last active admin while a deactivated admin remains', function () {
    $admin = actingAsInstanceAdmin($this);
    User::factory()->instanceAdmin()->deactivated()->create();

    $this->deleteJson(route('admin.admins.destroy', $admin))->assertUnprocessable();

    expect($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('lets a deactivated admin lose the role while one active admin remains', function () {
    $admin = actingAsInstanceAdmin($this);
    $deactivatedAdmin = User::factory()->instanceAdmin()->deactivated()->create();

    $this->deleteJson(route('admin.admins.destroy', $deactivatedAdmin))->assertRedirect();

    expect($deactivatedAdmin->fresh()->is_instance_admin)->toBeFalse()
        ->and($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('keeps one admin when two revocations follow each other', function () {
    $admin = actingAsInstanceAdmin($this);
    $other = User::factory()->instanceAdmin()->create();

    $this->deleteJson(route('admin.admins.destroy', $other))->assertRedirect();
    $this->deleteJson(route('admin.admins.destroy', $admin))->assertUnprocessable();

    expect(User::query()->where('is_instance_admin', true)->pluck('id')->all())->toBe([$admin->id]);
});

it('locks the admin rows inside a transaction before it counts them', function () {
    $admin = User::factory()->instanceAdmin()->create();
    $other = User::factory()->instanceAdmin()->create();
    $levelOutside = DB::transactionLevel();
    $revoked = null;

    $locks = SqlProbe::locks(function () use ($other, &$revoked): void {
        $revoked = resolve(RevokeInstanceAdmin::class)->handle($other);
    });

    expect($revoked)->toBeTrue()
        ->and($locks)->toBe([['table' => 'users', 'level' => $levelOutside + 1]])
        ->and(resolve(RevokeInstanceAdmin::class)->handle($admin))->toBeFalse()
        ->and($admin->fresh()->is_instance_admin)->toBeTrue();
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('treats the revocation of a user who is not an admin as done', function () {
    $admin = actingAsInstanceAdmin($this);
    $member = User::factory()->create();

    $this->delete(route('admin.admins.destroy', $member))->assertRedirect()->assertSessionHasNoErrors();

    expect($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('searches candidates by name or e-mail and leaves the admins out', function () {
    actingAsInstanceAdmin($this, ['name' => 'Marta Admin', 'email' => 'marta.admin@example.com']);
    $byName = User::factory()->create(['name' => 'Marta Lopez', 'email' => 'lopez@example.com']);
    $byEmail = User::factory()->create(['name' => 'Someone Else', 'email' => 'MARTA@example.org']);
    User::factory()->create(['name' => 'Unrelated', 'email' => 'unrelated@example.com']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => 'mart']))
        ->assertOk()
        ->assertExactJson([
            'candidates' => [
                ['id' => $byName->id, 'name' => 'Marta Lopez', 'email' => 'lopez@example.com', 'avatarUrl' => $byName->avatarUrl()],
                ['id' => $byEmail->id, 'name' => 'Someone Else', 'email' => $byEmail->email, 'avatarUrl' => $byEmail->avatarUrl()],
            ],
        ]);
});

it('returns at most ten candidates', function () {
    actingAsInstanceAdmin($this);
    User::factory()->count(12)->sequence(fn ($sequence) => ['name' => "Candidate {$sequence->index}"])->create();

    $this->getJson(route('admin.adminCandidates.index', ['query' => 'candidate']))
        ->assertOk()
        ->assertJsonCount(10, 'candidates');
});

it('refuses a candidate search shorter than two characters', function (?string $query) {
    actingAsInstanceAdmin($this);
    User::factory()->create(['name' => 'Marta']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => $query]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('query');
})->with([
    'one character' => ['m'],
    'empty' => [''],
    'spaces' => ['   '],
]);

it('takes wildcard characters of the search literally', function () {
    actingAsInstanceAdmin($this);
    User::factory()->create(['name' => 'Marta']);
    $literal = User::factory()->create(['name' => '100%_sure']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => '%_']))
        ->assertOk()
        ->assertJsonCount(1, 'candidates')
        ->assertJsonPath('candidates.0.id', $literal->id);
});

it('finds a literal match that sorts after more near misses than the list holds', function () {
    actingAsInstanceAdmin($this);
    User::factory()->count(12)->sequence(fn ($sequence): array => ['name' => "Aa {$sequence->index}"])->create();
    $literal = User::factory()->create(['name' => 'Zed 100%_sure']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => '%_']))
        ->assertOk()
        ->assertJsonCount(1, 'candidates')
        ->assertJsonPath('candidates.0.id', $literal->id);
});

it('stops reading near misses after a fixed number of accounts', function () {
    actingAsInstanceAdmin($this);
    User::factory()->count(AdminCandidatesController::MaxRowsRead)->sequence(fn ($sequence): array => ['name' => "Aa {$sequence->index}"])->create();
    User::factory()->create(['name' => 'Zed 100%_sure']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => '%_']))
        ->assertOk()
        ->assertExactJson(['candidates' => []]);
});

it('keeps the candidate search away from non-admins', function () {
    $this->actingAs(User::factory()->create());
    User::factory()->create(['name' => 'Marta']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => 'mart']))
        ->assertForbidden()
        ->assertJsonMissingPath('candidates');
});

it('keeps the candidate search away from an admin who has not confirmed their password', function () {
    $this->actingAs(User::factory()->instanceAdmin()->create());
    User::factory()->create(['name' => 'Marta']);

    $this->getJson(route('admin.adminCandidates.index', ['query' => 'mart']))
        ->assertStatus(423)
        ->assertJsonMissingPath('candidates');
});
