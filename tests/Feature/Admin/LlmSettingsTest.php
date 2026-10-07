<?php

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\InstanceSetting;
use App\Models\User;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;
use App\Support\InstanceConfiguration\InstanceConfiguration;
use App\Support\InstanceConfiguration\InstanceConfigurationBaseline;
use App\Support\Llm\Llm;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create();
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('stores encrypted AI credentials and uses them for model requests', function () {
    $this->put(route('admin.ai.update'), ['provider' => 'openai', 'key' => 'ai-secret', 'model' => 'local-model', 'base_url' => 'http://llm.internal:11434/v1/'])
        ->assertRedirect(route('admin.ai.edit'))->assertSessionHasNoErrors();

    $stored = InstanceSetting::query()->where('key', 'llm')->sole()->value;
    expect($stored['key'])->not->toBe('ai-secret');
    expect(Crypt::decryptString($stored['key']))->toBe('ai-secret');
    $this->get(route('admin.ai.edit'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/ai')->where('configured', true)
        ->where('fields.key.value', null)->where('fields.key.secretSet', true)
        ->where('fields.provider.source', 'stored'))->assertDontSee('ai-secret');

    Http::fake(['llm.internal:11434/*' => Http::response(['choices' => [['message' => ['content' => 'hello']]]])]);
    expect(resolve(Llm::class)->client()->complete('instructions', 'content'))->toBe('hello');
    Http::assertSent(fn (Request $request): bool => $request->url() === 'http://llm.internal:11434/v1/chat/completions'
        && $request->hasHeader('Authorization', 'Bearer ai-secret') && $request['model'] === 'local-model');
    expect(json_encode(AuditEvent::query()->where('action', AuditAction::ConfigurationUpdated)->sole()->properties))->not->toContain('ai-secret');
});

it('keeps a blank secret and restores environment values when cleared', function () {
    config(['services.llm.provider' => 'anthropic', 'services.llm.key' => 'environment-key', 'services.llm.model' => 'environment-model']);
    app()->instance(InstanceConfigurationBaseline::class, InstanceConfigurationBaseline::capture(new ConfigurationCatalogue));
    $this->put(route('admin.ai.update'), ['provider' => 'openai', 'key' => 'stored-key', 'model' => 'stored-model']);
    $this->put(route('admin.ai.update'), ['key' => '', 'model' => 'changed-model'])->assertSessionHasNoErrors();
    resolve(InstanceConfiguration::class)->apply();
    expect(config('services.llm.key'))->toBe('stored-key');

    $this->put(route('admin.ai.update'), ['clear' => ['provider', 'key', 'model']])->assertSessionHasNoErrors();
    resolve(InstanceConfiguration::class)->apply();
    expect(config('services.llm.key'))->toBe('environment-key');
    expect(config('services.llm.provider'))->toBe('anthropic');
});

it('rejects invalid AI settings without storing or flashing the key', function (array $values, string $field) {
    $this->put(route('admin.ai.update'), [...$values, 'key' => 'refused-secret'])->assertSessionHasErrors($field);
    $this->assertDatabaseMissing('instance_settings', ['key' => 'llm']);
    expect(json_encode(session()->all()))->not->toContain('refused-secret');
})->with([
    'provider' => [['provider' => 'unsupported'], 'provider'],
    'URL' => [['base_url' => 'file:///tmp/model'], 'base_url'],
]);

it('requires fresh confirmation for AI configuration writes', function () {
    $this->withSession(['auth.password_confirmed_at' => now()->subSeconds(301)->unix()])
        ->put(route('admin.ai.update'), ['key' => 'refused-secret'])->assertSessionHasErrors('confirmation');
    $this->assertDatabaseMissing('instance_settings', ['key' => 'llm']);
    expect(json_encode(session()->all()))->not->toContain('refused-secret');
});

it('restricts AI settings to instance admins', function () {
    $this->actingAs(User::factory()->create());
    $this->get(route('admin.ai.edit'))->assertForbidden();
    $this->put(route('admin.ai.update'), ['provider' => 'openai'])->assertForbidden();
});
