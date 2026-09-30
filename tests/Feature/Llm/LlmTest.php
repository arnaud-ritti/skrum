<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Models\Retro;
use App\Support\Llm\Llm;
use App\Support\Llm\LlmJson;
use App\Support\Llm\LlmUnavailable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

it('is only configured with a known provider, a key and a model', function (array $settings, bool $configured) {
    config(['services.llm' => $settings]);

    expect(app(Llm::class)->isConfigured())->toBe($configured);
})->with([
    'complete' => [['provider' => 'anthropic', 'key' => 'k', 'model' => 'm', 'base_url' => null], true],
    'openai' => [['provider' => 'openai', 'key' => 'k', 'model' => 'm', 'base_url' => null], true],
    'no key' => [['provider' => 'anthropic', 'key' => '', 'model' => 'm', 'base_url' => null], false],
    'no model' => [['provider' => 'anthropic', 'key' => 'k', 'model' => null, 'base_url' => null], false],
    'unknown provider' => [['provider' => 'mistral', 'key' => 'k', 'model' => 'm', 'base_url' => null], false],
    'nothing' => [['provider' => null, 'key' => null, 'model' => null, 'base_url' => null], false],
]);

it('names the provider for privacy notices', function () {
    configureLlm();
    expect(app(Llm::class)->providerName())->toBe('Anthropic');

    configureLlm('openai');
    expect(app(Llm::class)->providerName())->toBe('OpenAI');

    configureLlm('openai', 'https://llm.internal.example/v1');
    expect(app(Llm::class)->providerName())->toBe('llm.internal.example');

    config(['services.llm.key' => null]);
    expect(app(Llm::class)->providerName())->toBeNull();
});

it('calls the anthropic messages api from the server', function () {
    configureLlm();
    fakeLlmReply('hello');

    expect(app(Llm::class)->client()->complete('system text', 'user text'))->toBe('hello');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key')
        && $request['model'] === 'test-model'
        && $request['system'] === 'system text'
        && $request['messages'] === [['role' => 'user', 'content' => 'user text']]);
});

it('calls any openai compatible server at the configured base url', function () {
    configureLlm('openai', 'https://llm.internal.example/v1');
    Http::fake(['llm.internal.example/*' => Http::response(['choices' => [['message' => ['content' => 'hi']]]])]);

    expect(app(Llm::class)->client()->complete('system text', 'user text'))->toBe('hi');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://llm.internal.example/v1/chat/completions'
        && $request->hasHeader('Authorization', 'Bearer llm-secret-key')
        && $request['messages'] === [['role' => 'system', 'content' => 'system text'], ['role' => 'user', 'content' => 'user text']]);
});

it('reports provider errors without the key', function () {
    configureLlm();
    fakeLlmFailure();

    expect(fn () => app(Llm::class)->client()->complete('s', 'u'))
        ->toThrow(fn (LlmUnavailable $exception) => expect($exception->getMessage())->not->toContain('llm-secret-key'));
});

it('refuses to build a client without a provider', function () {
    config(['services.llm' => ['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]]);

    expect(fn () => app(Llm::class)->client())->toThrow(LlmUnavailable::class);
});

it('decodes json replies with fences or surrounding prose', function (string $reply, ?array $expected) {
    expect(LlmJson::decode($reply))->toBe($expected);
})->with([
    'plain' => ['{"a":1}', ['a' => 1]],
    'fenced' => ["```json\n{\"a\":1}\n```", ['a' => 1]],
    'prose before' => ['Here you go: [{"a":1}]', [['a' => 1]]],
    'prose after' => ['{"a":1} Hope this helps! [really]', ['a' => 1]],
    'not json' => ['sorry, I cannot', null],
]);

it('exposes whether llm features are available in the snapshot', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    config(['services.llm' => ['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]]);
    expect(app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer)['features'])
        ->toBe(['llm' => false, 'llmProvider' => null]);

    configureLlm();
    $snapshot = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $viewer);

    expect($snapshot['features'])->toBe(['llm' => true, 'llmProvider' => 'Anthropic'])
        ->and(json_encode($snapshot))->not->toContain('llm-secret-key');
});
