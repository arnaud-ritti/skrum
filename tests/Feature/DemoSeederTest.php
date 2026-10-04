<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
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
    $roles = $workspace->members()->get()->mapWithKeys(fn (User $user) => [$user->email => $user->membership->role->value]);

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
