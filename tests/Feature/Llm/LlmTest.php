<?php

use App\Exceptions\Llm\LlmUnavailable;
use App\Models\Retro;
use App\Support\Llm\Llm;
use App\Support\Llm\LlmJson;
use App\Support\Llm\TextGenerationAgent;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Laravel\Ai\Exceptions\AiException;
use Laravel\Ai\Prompts\AgentPrompt;

it('enables AI only when the selected provider has its required configuration', function (array $settings, bool $configured) {
    config(['services.llm' => $settings]);

    expect(resolve(Llm::class)->isConfigured())->toBe($configured);
})->with([
    'complete' => [['provider' => 'anthropic', 'key' => 'k', 'model' => 'm', 'base_url' => null], true],
    'openai' => [['provider' => 'openai', 'key' => 'k', 'model' => 'm', 'base_url' => null], true],
    'no key' => [['provider' => 'anthropic', 'key' => '', 'model' => 'm', 'base_url' => null], false],
    'no model' => [['provider' => 'anthropic', 'key' => 'k', 'model' => null, 'base_url' => null], false],
    'mistral' => [['provider' => 'mistral', 'key' => 'k', 'model' => 'm'], true],
    'gemini' => [['provider' => 'gemini', 'key' => 'k', 'model' => 'm'], true],
    'keyless ollama' => [['provider' => 'ollama', 'key' => null, 'model' => 'm'], true],
    'keyless compatible' => [['provider' => 'openai-compatible', 'key' => null, 'model' => 'm', 'base_url' => 'http://llm:8000/v1'], true],
    'compatible without URL' => [['provider' => 'openai-compatible', 'key' => 'k', 'model' => 'm'], false],
    'azure without URL' => [['provider' => 'azure', 'key' => 'k', 'model' => 'm'], false],
    'bedrock bearer' => [['provider' => 'bedrock', 'key' => 'k', 'model' => 'm'], true],
    'bedrock without credentials' => [['provider' => 'bedrock', 'key' => null, 'model' => 'm'], false],
    'bedrock IAM role' => [['provider' => 'bedrock', 'key' => null, 'model' => 'm', 'bedrock_use_default_credentials' => true], true],
    'unknown provider' => [['provider' => 'unsupported', 'key' => 'k', 'model' => 'm'], false],
    'nothing' => [['provider' => null, 'key' => null, 'model' => null, 'base_url' => null], false],
]);

it('names the provider for privacy notices', function () {
    configureLlm();
    expect(resolve(Llm::class)->providerName())->toBe('Anthropic');

    configureLlm('openai');
    expect(resolve(Llm::class)->providerName())->toBe('OpenAI');

    configureLlm('openai', 'https://llm.internal.example/v1');
    expect(resolve(Llm::class)->providerName())->toBe('llm.internal.example');

    configureLlm('anthropic', 'https://llm.gateway.example');
    expect(resolve(Llm::class)->providerName())->toBe('llm.gateway.example');

    config(['services.llm.key' => null]);
    expect(resolve(Llm::class)->providerName())->toBeNull();
});

it('calls the anthropic messages api from the server', function () {
    configureLlm();
    fakeLlmReply('hello');

    expect(resolve(Llm::class)->client()->complete('system text', 'user text'))->toBe('hello');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.anthropic.com/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key')
        && $request['model'] === 'test-model'
        && $request['system'] === 'system text'
        && $request['max_tokens'] === 4096
        && $request['messages'] === [['role' => 'user', 'content' => [['type' => 'text', 'text' => 'user text']]]]);
});

it('calls any openai compatible server at the configured base url', function () {
    configureLlm('openai', 'https://llm.internal.example/v1');
    Http::fake(['llm.internal.example/*' => Http::response(['choices' => [['message' => ['content' => 'hi']]]])]);

    expect(resolve(Llm::class)->client()->complete('system text', 'user text'))->toBe('hi');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://llm.internal.example/v1/chat/completions'
        && $request->hasHeader('Authorization', 'Bearer llm-secret-key')
        && $request['messages'] === [['role' => 'system', 'content' => 'system text'], ['role' => 'user', 'content' => 'user text']]);
});

it('preserves existing Anthropic gateway base URLs', function () {
    configureLlm('anthropic', 'https://gateway.example/');
    Http::fake(['https://gateway.example/v1/messages' => Http::response(['content' => [['type' => 'text', 'text' => 'hi']]])]);

    expect(resolve(Llm::class)->client()->complete('instructions', 'content'))->toBe('hi');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://gateway.example/v1/messages'
        && $request->hasHeader('x-api-key', 'llm-secret-key'));
});

it('calls OpenAI Responses without storing the response', function () {
    configureLlm('openai');
    Http::fake(['https://api.openai.com/v1/responses' => Http::response([
        'id' => 'response-id', 'model' => 'test-model', 'status' => 'completed',
        'output' => [['type' => 'message', 'role' => 'assistant', 'content' => [['type' => 'output_text', 'text' => 'hi']]]],
    ])]);

    expect(resolve(Llm::class)->client()->complete('instructions', 'content'))->toBe('hi');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'https://api.openai.com/v1/responses'
        && $request->hasHeader('Authorization', 'Bearer llm-secret-key')
        && $request['model'] === 'test-model' && $request['store'] === false);
});

it('reports provider errors without the key', function () {
    configureLlm();
    fakeLlmFailure();

    expect(fn () => resolve(Llm::class)->client()->complete('s', 'u'))
        ->toThrow(fn (LlmUnavailable $exception) => expect($exception->getMessage())->not->toContain('llm-secret-key'));
});

it('refuses to build a client without a provider', function () {
    config(['services.llm' => ['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]]);

    expect(fn () => resolve(Llm::class)->client())->toThrow(LlmUnavailable::class);
});

it('sends model and instructions through each SDK text provider', function (string $provider, ?string $url) {
    configureLlm($provider, $url);
    TextGenerationAgent::fake(['hello']);

    expect(resolve(Llm::class)->client()->complete('system text', 'user text'))->toBe('hello');

    TextGenerationAgent::assertPrompted(fn (AgentPrompt $prompt): bool => $prompt->provider->driver() === $provider
        && $prompt->provider->providerCredentials()['key'] === 'llm-secret-key'
        && $prompt->model === 'test-model'
        && $prompt->agent->instructions() === 'system text'
        && $prompt->prompt === 'user text'
        && $prompt->timeout === 60);
})->with([
    ['anthropic', null], ['openai', null], ['openai-compatible', 'https://llm.example/v1'],
    ['gemini', null], ['azure', 'https://example.openai.azure.com'], ['bedrock', null],
    ['groq', null], ['xai', null], ['deepseek', null], ['mistral', null], ['ollama', null], ['openrouter', null],
]);

it('calls a keyless compatible server without bearer authentication', function () {
    configureLlm('openai-compatible', 'http://llm:8000/v1');
    config(['services.llm.key' => null]);
    Http::fake(['http://llm:8000/v1/chat/completions' => Http::response(['choices' => [['message' => ['content' => 'hi']]]])]);

    expect(resolve(Llm::class)->client()->complete('system text', 'user text'))->toBe('hi');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'http://llm:8000/v1/chat/completions'
        && ! $request->hasHeader('Authorization') && $request['model'] === 'test-model');
});

it('calls the native Ollama API without a key', function () {
    configureLlm('ollama', 'http://llm:11434');
    config(['services.llm.key' => null]);
    Http::fake(['http://llm:11434/api/chat' => Http::response(['message' => ['content' => 'hi'], 'done' => true])]);

    expect(resolve(Llm::class)->client()->complete('system text', 'user text'))->toBe('hi');

    Http::assertSent(fn (Request $request): bool => $request->url() === 'http://llm:11434/api/chat'
        && ! $request->hasHeader('Authorization') && $request['model'] === 'test-model');
});

it('uses the chosen Bedrock region and AWS credentials', function () {
    configureLlm('bedrock');
    config(['services.llm.key' => null, 'services.llm.bedrock_region' => 'eu-west-3',
        'services.llm.bedrock_access_key_id' => 'aws-id', 'services.llm.bedrock_secret_access_key' => 'aws-secret',
        'services.llm.bedrock_session_token' => 'aws-session']);
    TextGenerationAgent::fake(['hello']);

    expect(resolve(Llm::class)->client()->complete('system', 'user'))->toBe('hello');

    TextGenerationAgent::assertPrompted(fn (AgentPrompt $prompt): bool => $prompt->provider->driver() === 'bedrock'
        && $prompt->provider->additionalConfiguration()['region'] === 'eu-west-3'
        && $prompt->provider->providerCredentials() === ['access_key_id' => 'aws-id', 'secret_access_key' => 'aws-secret', 'session_token' => 'aws-session']);
});

it('names native Bedrock correctly even when an old gateway URL remains', function () {
    configureLlm('bedrock', 'https://old-gateway.example/v1');

    expect(resolve(Llm::class)->providerName())->toBe('Amazon Bedrock');
});

it('passes an explicitly enabled IAM credential chain to Bedrock', function () {
    configureLlm('bedrock');
    config(['services.llm.key' => null, 'services.llm.bedrock_use_default_credentials' => true]);
    TextGenerationAgent::fake(['hello']);

    expect(resolve(Llm::class)->client()->complete('instructions', 'content'))->toBe('hello');

    TextGenerationAgent::assertPrompted(fn (AgentPrompt $prompt): bool => $prompt->provider->additionalConfiguration()['use_default_credential_provider'] === true
        && $prompt->provider->providerCredentials() === []);
});

it('handles a provider connection failure without exposing credentials', function () {
    configureLlm();
    Http::fake(['https://api.anthropic.com/v1/messages' => Http::failedConnection()]);

    expect(fn () => resolve(Llm::class)->client()->complete('instructions', 'content'))->toThrow(LlmUnavailable::class);
});

it('turns SDK errors into an unavailable response without retaining secrets', function () {
    configureLlm('bedrock');
    TextGenerationAgent::fake(fn () => throw new AiException('Provider rejected llm-secret-key'));

    expect(fn () => resolve(Llm::class)->client()->complete('system', 'user'))
        ->toThrow(fn (LlmUnavailable $exception) => expect($exception->getMessage())->not->toContain('llm-secret-key')
            ->and($exception->getPrevious())->toBeNull());
});

it('rejects an empty SDK reply', function () {
    configureLlm();
    TextGenerationAgent::fake(['']);

    expect(fn () => resolve(Llm::class)->client()->complete('system', 'user'))->toThrow(LlmUnavailable::class);
});

it('decodes json replies with fences or surrounding prose', function (string $reply, ?array $expected) {
    expect(LlmJson::decode($reply))->toBe($expected);
})->with([
    'plain' => ['{"a":1}', ['a' => 1]],
    'fenced' => ["```json\n{\"a\":1}\n```", ['a' => 1]],
    'prose before' => ['Here you go: [{"a":1}]', [['a' => 1]]],
    'prose after' => ['{"a":1} Hope this helps! [really]', ['a' => 1]],
    'not json' => ['sorry, I cannot', null],
    'fence inside a value' => ["```json\n{\"summary\":\"Use ```php``` blocks\"}\n```", ['summary' => 'Use ```php``` blocks']],
    'unfenced fence inside a value' => ['{"summary":"Use ```php``` blocks"}', ['summary' => 'Use ```php``` blocks']],
]);

it('exposes whether llm features are available in the snapshot', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);

    config(['services.llm' => ['provider' => null, 'key' => null, 'model' => null, 'base_url' => null]]);
    expect(boardSnapshot($retro, $viewer)['features'])
        ->toBe(['llm' => false, 'llmProvider' => null]);

    configureLlm();
    $snapshot = boardSnapshot($retro, $viewer);

    expect($snapshot['features'])->toBe(['llm' => true, 'llmProvider' => 'Anthropic'])
        ->and(json_encode($snapshot))->not->toContain('llm-secret-key');
});
