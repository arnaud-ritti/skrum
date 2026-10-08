<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\DemoSeeder;

beforeEach(function () {
    app()->detectEnvironment(fn () => 'local');
});

it('creates the demo users, workspace, team and retro', function () {
    $this->seed(DemoSeeder::class);

    expect(User::count())->toBe(3);

    $workspace = Workspace::where('name', 'Demo Workspace')->firstOrFail();
    $roles = $workspace->members()->orderBy('email')->get()->mapWithKeys(fn (User $user) => [$user->email => $user->membership->role->value]);

    expect($roles->all())->toBe([
        'admin@skrum.test' => WorkspaceRole::Owner->value,
        'facilitator@skrum.test' => WorkspaceRole::Member->value,
        'member@skrum.test' => WorkspaceRole::Member->value,
    ]);

    $team = Team::where('name', 'Demo Team')->firstOrFail();
    $teamRoles = $team->members()->get()->mapWithKeys(fn (User $user) => [$user->email => $team->roleOf($user)]);

    expect($teamRoles->all())->toEqualCanonicalizing([
        'facilitator@skrum.test' => TeamRole::Facilitator,
        'member@skrum.test' => TeamRole::Member,
    ]);

    $retro = Retro::firstOrFail();
    $fran = User::where('email', 'facilitator@skrum.test')->firstOrFail();

    expect($retro->guest_access_enabled)->toBeTrue()
        ->and($retro->facilitator->user_id)->toBe($fran->id)
        ->and(User::where('email', 'member@skrum.test')->value('current_workspace_id'))->toBe($workspace->id)
        ->and($fran->current_workspace_id)->toBe($workspace->id)
        ->and($fran->email_verified_at)->not->toBeNull();
});

it('gives every demo user a password they set, so the password flows apply to them', function () {
    $this->seed(DemoSeeder::class);

    expect(User::query()->whereNull('password_set_at')->count())->toBe(0);
});

it('makes the demo admin, and only them, an instance admin', function () {
    $this->seed(DemoSeeder::class);

    $instanceAdmins = User::query()->where('is_instance_admin', true)->pluck('email')->all();

    expect($instanceAdmins)->toBe(['admin@skrum.test']);
});

it('does not duplicate anything when run twice', function () {
    $this->seed(DemoSeeder::class);
    $this->seed(DemoSeeder::class);

    expect(User::count())->toBe(3)
        ->and(Workspace::count())->toBe(1)
        ->and(Team::count())->toBe(1)
        ->and(Retro::count())->toBe(1)
        ->and(Participant::count())->toBe(1);
});

it('does nothing outside the local environment', function () {
    app()->detectEnvironment(fn () => 'staging');

    $this->seed(DemoSeeder::class);

    expect(User::count())->toBe(0)
        ->and(Workspace::count())->toBe(0)
        ->and(Retro::count())->toBe(0);
});

it('seeds a public demo in production with two accounts and no administrator', function () {
    app()->detectEnvironment(fn () => 'production');
    config(['skrum.demo.enabled' => true]);

    $this->artisan('db:seed', ['--class' => DemoSeeder::class, '--force' => true])->assertSuccessful();
    $this->artisan('db:seed', ['--class' => DemoSeeder::class, '--force' => true])->assertSuccessful();

    expect(User::count())->toBe(2)
        ->and(User::where('is_instance_admin', true)->count())->toBe(0)
        ->and(Workspace::firstOrFail()->members()->where('email', 'facilitator@skrum.test')->firstOrFail()->membership->role)->toBe(WorkspaceRole::Owner)
        ->and(Card::count())->toBe(3);
});

it('prevents visitors from changing demo credentials or registering additional accounts', function () {
    app()->detectEnvironment(fn () => 'testing');
    config(['skrum.demo.enabled' => true]);
    $this->seed(DemoSeeder::class);
    $facilitator = User::where('email', 'facilitator@skrum.test')->firstOrFail();

    $this->actingAs($facilitator)->patch('/settings/profile', ['name' => 'Changed'])->assertForbidden();
    $this->put('/settings/password', ['password' => 'changed'])->assertForbidden();
    $this->post('/user/two-factor-authentication')->assertForbidden();
    $this->post('/register')->assertForbidden();

    expect($facilitator->fresh()->name)->toBe('Fran Facilitator')
        ->and(User::count())->toBe(2);
});

it('lets each public demo account log in with the advertised password', function (string $email) {
    app()->detectEnvironment(fn () => 'testing');
    config(['skrum.demo.enabled' => true]);
    $this->seed(DemoSeeder::class);

    $this->post('/login', ['email' => $email, 'password' => 'password'])->assertRedirect();

    $this->assertAuthenticatedAs(User::where('email', $email)->firstOrFail());
})->with(['facilitator@skrum.test', 'member@skrum.test']);

it('allows changing the DiceBear avatar by default without changing demo credentials', function () {
    app()->detectEnvironment(fn () => 'testing');
    config(['skrum.demo.enabled' => true]);
    $this->seed(DemoSeeder::class);
    $facilitator = User::where('email', 'facilitator@skrum.test')->firstOrFail();

    $this->actingAs($facilitator)->patch('/settings/profile', [
        'name' => $facilitator->name,
        'email' => $facilitator->email,
        'avatar_style' => 'micah',
    ])->assertRedirect();

    expect($facilitator->fresh()->avatar_style)->toBe('micah')
        ->and($facilitator->fresh()->email)->toBe('facilitator@skrum.test');

    $this->patch('/settings/profile', [
        'name' => $facilitator->name, 'email' => 'visitor@example.com', 'avatar_style' => 'thumbs',
    ])->assertForbidden();

    expect($facilitator->fresh()->email)->toBe('facilitator@skrum.test')
        ->and($facilitator->fresh()->avatar_style)->toBe('micah');
});
