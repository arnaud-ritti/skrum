<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create(['created_at' => now()->subYear()]);
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('lists accounts newest first, 25 a page', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 12, 0, 0));
    $older = User::factory()->create(['created_at' => now()->subDay()]);
    $newer = User::factory()->create(['created_at' => now()]);

    $this->get(route('admin.users.index'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/users')
        ->where('users.data.0.id', $newer->id)
        ->where('users.data.1.id', $older->id)
        ->where('users.data.2.id', $this->admin->id)
        ->where('users.data.2.isSelf', true)
        ->where('users.data.2.isAdmin', true)
        ->where('users.data.0.isSelf', false)
        ->where('activeAdminCount', 1)
        ->where('filters', ['query' => null, 'status' => 'all']));
});

it('pages the accounts by 25', function () {
    User::factory()->count(25)->create();

    $this->get(route('admin.users.index'))->assertInertia(fn (Assert $page) => $page->has('users.data', 25));
    $this->get(route('admin.users.index', ['page' => 2]))->assertInertia(fn (Assert $page) => $page->has('users.data', 1));
});

it('filters by status and searches names and addresses', function () {
    User::factory()->deactivated()->create(['name' => 'Théo Martin']);
    User::factory()->create(['name' => 'Camille Roux', 'email' => 'camille@atlas.fr']);

    $this->get(route('admin.users.index', ['status' => 'deactivated']))
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.name', 'Théo Martin')->where('users.data.0.isDeactivated', true));
    $this->get(route('admin.users.index', ['query' => 'ATLAS']))
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.name', 'Camille Roux'));
    $this->get(route('admin.users.index', ['status' => 'admins']))
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.id', $this->admin->id));
});

it('refuses an unknown status filter', function () {
    $this->get(route('admin.users.index', ['status' => 'everyone']))->assertSessionHasErrors('status');
});

it('is for instance admins only', function () {
    $this->actingAs(User::factory()->create())->get(route('admin.users.index'))->assertForbidden();
});
