<?php

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create();
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('offers the workspaces by name and shows the one set', function () {
    $zephyr = Workspace::factory()->create(['name' => 'Zephyr']);
    $aurora = Workspace::factory()->create(['name' => 'Aurora']);
    resolve(InstanceSettings::class)->set('default_workspace', $zephyr->id);

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('defaultWorkspaceId', $zephyr->id)
        ->where('workspaces', [['id' => $aurora->id, 'name' => 'Aurora'], ['id' => $zephyr->id, 'name' => 'Zephyr']]));
});

it('stores the default workspace, audits the change and clears it', function () {
    $workspace = Workspace::factory()->create();

    $this->put(route('admin.defaultWorkspace.update'), ['default_workspace_id' => $workspace->id])
        ->assertRedirect(route('admin.signIn.edit'));

    expect(resolve(InstanceSettings::class)->defaultWorkspaceId())->toBe($workspace->id)
        ->and(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->sole()->properties)
        ->toEqual(['section' => 'sign_in', 'keys' => ['default_workspace']]);

    $this->put(route('admin.defaultWorkspace.update'), ['default_workspace_id' => null])->assertRedirect(route('admin.signIn.edit'));

    expect(resolve(InstanceSettings::class)->defaultWorkspaceId())->toBeNull();
});

it('shows no default workspace once the one set was deleted', function () {
    $workspace = Workspace::factory()->create();
    resolve(InstanceSettings::class)->set('default_workspace', $workspace->id);
    $workspace->delete();

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page->where('defaultWorkspaceId', null));
});

it('refuses a workspace that does not exist', function () {
    $this->put(route('admin.defaultWorkspace.update'), ['default_workspace_id' => (string) Str::uuid7()])
        ->assertSessionHasErrors('default_workspace_id');
});

it('keeps the default workspace through a Branding reset', function () {
    $workspace = Workspace::factory()->create();
    resolve(InstanceSettings::class)->set('default_workspace', $workspace->id);

    $this->delete(route('admin.branding.destroy'));

    expect(resolve(InstanceSettings::class)->defaultWorkspaceId())->toBe($workspace->id);
});

it('lets no one but an instance admin set it', function () {
    $this->actingAs(User::factory()->create())
        ->withSession(['auth.password_confirmed_at' => time()])
        ->put(route('admin.defaultWorkspace.update'), ['default_workspace_id' => null])
        ->assertForbidden();
});
