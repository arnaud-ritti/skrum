<?php

namespace App\Support\Llm;

use App\Enums\LlmProvider;
use App\Exceptions\Llm\LlmUnavailable;

class Llm
{
    public const TimeoutSeconds = 60;

    public function isConfigured(): bool
    {
        $provider = $this->provider();

        if ($provider === null || $this->model() === null || ($provider->requiresKey() && $this->key() === null)) {
            return false;
        }

        if (in_array($provider, [LlmProvider::OpenAiCompatible, LlmProvider::Azure], true) && $this->baseUrl() === null) {
            return false;
        }

        if ($provider === LlmProvider::Bedrock) {
            return $this->key() !== null
                || ($this->filled(config('services.llm.bedrock_access_key_id')) !== null && $this->filled(config('services.llm.bedrock_secret_access_key')) !== null)
                || (bool) config('services.llm.bedrock_use_default_credentials', false);
        }

        return true;
    }

    public function providerName(): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $host = parse_url((string) $this->baseUrl(), PHP_URL_HOST);

        if ($this->provider() !== LlmProvider::Bedrock && is_string($host) && $host !== '') {
            return $host;
        }

        return $this->provider()?->label();
    }

    public function client(): LlmClient
    {
        $provider = $this->provider();
        $model = $this->model();

        throw_if(! $this->isConfigured() || $provider === null || $model === null, LlmUnavailable::class);

        return new SdkLlmClient($this->providerConfiguration($provider), $model);
    }

    /** @return array<string, mixed> */
    private function providerConfiguration(LlmProvider $provider): array
    {
        $configuration = [
            'driver' => $provider->value,
            'key' => $this->key(),
            'store' => false,
            'models' => ['text' => ['default' => $this->model()]],
        ];
        $baseUrl = $this->baseUrl();

        if ($baseUrl !== null) {
            $configuration['url'] = $provider === LlmProvider::Anthropic && ! str_ends_with($baseUrl, '/v1')
                ? $baseUrl.'/v1'
                : $baseUrl;

            if ($provider === LlmProvider::OpenAi) {
                $configuration['driver'] = LlmProvider::OpenAiCompatible->value;
            }
        }

        if ($provider === LlmProvider::Bedrock) {
            $configuration = [
                ...$configuration,
                'region' => $this->filled(config('services.llm.bedrock_region')) ?? 'us-east-1',
                'access_key_id' => $this->filled(config('services.llm.bedrock_access_key_id')),
                'secret_access_key' => $this->filled(config('services.llm.bedrock_secret_access_key')),
                'session_token' => $this->filled(config('services.llm.bedrock_session_token')),
                'use_default_credential_provider' => (bool) config('services.llm.bedrock_use_default_credentials', false),
            ];
        }

        if ($provider === LlmProvider::Azure) {
            $configuration['deployment'] = $this->model();
        }

        return $configuration;
    }

    private function provider(): ?LlmProvider
    {
        $provider = config('services.llm.provider');

        return is_string($provider) ? LlmProvider::tryFrom($provider) : null;
    }

    private function key(): ?string
    {
        return $this->filled(config('services.llm.key'));
    }

    private function model(): ?string
    {
        return $this->filled(config('services.llm.model'));
    }

    private function baseUrl(): ?string
    {
        $baseUrl = $this->filled(config('services.llm.base_url'));

        return $baseUrl === null ? null : rtrim($baseUrl, '/');
    }

    private function filled(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
