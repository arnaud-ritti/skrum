<?php

use App\Models\User;
use App\Support\InstanceVersion;
use Inertia\Testing\AssertableInertia as Assert;

it('names the AGPL-3.0-or-later and counts active accounts only on the licence card', function () {
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
    User::factory()->count(2)->create();
    User::factory()->deactivated()->create();

    $this->get(route('admin.licence.show'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/licence')
        ->where('licence', 'AGPL-3.0-or-later')
        ->where('licenceUrl', config('skrum.licence_url'))
        ->where('repositoryUrl', config('skrum.repository_url'))
        ->where('version', resolve(InstanceVersion::class)->current())
        ->where('accountsInUse', 3));
});

it('refuses the licence page to a member who is not an instance admin', function () {
    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->get(route('admin.licence.show'))->assertForbidden();
});
