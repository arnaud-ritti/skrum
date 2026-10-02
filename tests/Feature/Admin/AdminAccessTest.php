<?php

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia;

const AdminAccessSeed = '5f2b8c1e9a4d47f0b3c6d8e1a7f90214';

const AdminAccessBrandingPayload = [
    'brand_color' => '#2b63b0',
    'brand_radius' => 8,
    'display_name' => 'Acme',
    'powered_by' => true,
    'avatar_style' => 'thumbs',
    'avatar_member_choice' => false,
    'gif_provider' => null,
    'gif_enabled' => false,
    'gif_rating' => 'g',
];

function adminAccessCall(mixed $test, string $method, string $url, array $payload): mixed
{
    return $method === 'get' ? $test->get($url) : $test->{$method}($url, $payload);
}

dataset('adminRoutes', [
    'admin home' => ['get', fn () => '/admin', fn () => [], 302, false],
    'branding page' => ['get', fn () => route('admin.branding.edit'), fn () => [], 200, true],
    'branding update' => ['put', fn () => route('admin.branding.update'), fn () => AdminAccessBrandingPayload, 302, true],
    'branding reset' => ['delete', fn () => route('admin.branding.destroy'), fn () => [], 302, true],
    'branding preview' => ['get', fn () => route('admin.brandingPreview.show', ['color' => '#2b63b0']), fn () => [], 200, false],
    'asset upload' => [
        'post',
        fn () => route('admin.brandingAssets.store', 'logo-light'),
        fn () => ['file' => UploadedFile::fake()->createWithContent('logo.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>')],
        302,
        true,
    ],
    'asset removal' => ['delete', fn () => route('admin.brandingAssets.destroy', 'logo-light'), fn () => [], 302, true],
    'admins page' => ['get', fn () => route('admin.admins.index'), fn () => [], 200, true],
    'admin grant' => ['post', fn () => route('admin.admins.store'), fn () => ['user_id' => User::factory()->create()->id], 302, true],
    'admin revocation' => ['delete', fn () => route('admin.admins.destroy', User::factory()->instanceAdmin()->create()), fn () => [], 302, true],
    'admin candidates' => ['get', fn () => route('admin.adminCandidates.index', ['query' => 'ab']), fn () => [], 200, true],
    'avatar preview' => ['get', fn () => route('admin.avatarPreviews.show', ['style' => 'thumbs', 'seed' => AdminAccessSeed]), fn () => [], 200, false],
]);

beforeEach(function () {
    Storage::fake('local');
});

it('sends a guest to the login page', function (string $method, string $url, array $payload) {
    adminAccessCall($this, $method, $url, $payload)->assertRedirect(route('login'));
})->with('adminRoutes');

it('answers 403 to a signed-in user who is not an instance admin', function (string $method, string $url, array $payload) {
    $this->actingAs(User::factory()->create())
        ->withSession(['auth.password_confirmed_at' => time()]);

    adminAccessCall($this, $method, $url, $payload)->assertForbidden();
})->with('adminRoutes');

it('sends an admin whose e-mail is not verified to the verification notice', function (string $method, string $url, array $payload) {
    $this->actingAs(User::factory()->instanceAdmin()->unverified()->create())
        ->withSession(['auth.password_confirmed_at' => time()]);

    adminAccessCall($this, $method, $url, $payload)->assertRedirect(route('verification.notice'));
})->with('adminRoutes');

it('lets an instance admin through', function (string $method, string $url, array $payload, int $status) {
    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->withSession(['auth.password_confirmed_at' => time()]);

    adminAccessCall($this, $method, $url, $payload)->assertStatus($status);
})->with('adminRoutes');

it('asks an admin to confirm their password before the pages and every change', function (string $method, string $url, array $payload, int $status, bool $confirmsPassword) {
    $this->actingAs(User::factory()->instanceAdmin()->create());

    $response = adminAccessCall($this, $method, $url, $payload);

    $confirmsPassword
        ? $response->assertRedirect(route('password.confirm'))
        : $response->assertStatus($status);
})->with('adminRoutes');

it('changes nothing when a non-admin posts to the admin area', function () {
    $member = User::factory()->create();
    $admin = User::factory()->instanceAdmin()->create();

    $this->actingAs($member)->withSession(['auth.password_confirmed_at' => time()]);

    $this->put(route('admin.branding.update'), AdminAccessBrandingPayload)->assertForbidden();
    $this->post(route('admin.admins.store'), ['user_id' => $member->id])->assertForbidden();
    $this->delete(route('admin.admins.destroy', $admin))->assertForbidden();

    $this->assertDatabaseCount('instance_settings', 0);

    expect($member->fresh()->is_instance_admin)->toBeFalse()
        ->and($admin->fresh()->is_instance_admin)->toBeTrue();
});

it('redirects the admin home to the branding page', function () {
    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->get('/admin')
        ->assertRedirect(route('admin.branding.edit'));

    $this->post('/admin')->assertMethodNotAllowed();
});

it('shares the admin link with instance admins only', function () {
    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->get(route('profile.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('adminUrl', route('admin.branding.edit')));

    $this->actingAs(User::factory()->create())
        ->get(route('profile.edit'))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('adminUrl', null));
});
