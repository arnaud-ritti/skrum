<?php

use App\Models\InstanceSetting;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

dataset('configuration writes', [
    'sso provider' => [fn () => route('admin.ssoProviders.update', 'oidc'), ['client_id' => 'skrum-stored', 'client_secret' => 'route-secret-value'], 'sso_oidc'],
    'ai' => [fn () => route('admin.ai.update'), ['provider' => 'openai', 'key' => 'route-secret-value'], 'llm'],
    'smtp' => [fn () => route('admin.mail.update'), ['host' => 'smtp.stored.test', 'password' => 'route-secret-value'], 'smtp'],
    'integration app' => [fn () => route('admin.integrationApps.update', 'linear'), ['client_id' => 'linear-id', 'client_secret' => 'route-secret-value'], 'integration_linear'],
]);

beforeEach(function () {
    Mail::fake();
    $this->admin = User::factory()->instanceAdmin()->create();
});

it('S2: refuses a write whose confirmation is older than five minutes, also for an account without a known password', function (Closure $url, array $values, string $section, bool $hasPassword) {
    $admin = $hasPassword ? $this->admin : User::factory()->instanceAdmin()->create(['password_set_at' => null]);
    $this->actingAs($admin)->withSession(['auth.password_confirmed_at' => now()->subSeconds(301)->unix()]);

    $this->from(route('admin.signIn.edit'))->put($url(), $values)->assertSessionHasErrors('confirmation');

    expect(InstanceSetting::query()->where('key', $section)->exists())->toBeFalse();
})->with('configuration writes')->with(['with a password' => true, 'without a known password' => false]);

it('S2: accepts a write confirmed less than five minutes ago', function (Closure $url, array $values, string $section) {
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => now()->subSeconds(299)->unix()]);

    $this->put($url(), $values)->assertSessionHasNoErrors();

    expect(InstanceSetting::query()->where('key', $section)->exists())->toBeTrue();
})->with('configuration writes');

it('S5: keeps no secret in the session after a refused write', function (Closure $url, array $values) {
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => now()->subSeconds(301)->unix()]);

    $this->put($url(), $values);

    expect(json_encode(session()->all()))->not->toContain('route-secret-value');
})->with('configuration writes');
