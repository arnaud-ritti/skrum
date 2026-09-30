<?php

namespace App\Support\Llm;

class Llm
{
    public const TimeoutSeconds = 60;

    public function isConfigured(): bool
    {
        return $this->provider() !== null && $this->key() !== null && $this->model() !== null;
    }

    public function providerName(): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        if ($this->provider() === 'anthropic') {
            return 'Anthropic';
        }

        $host = parse_url((string) $this->baseUrl(), PHP_URL_HOST);

        return is_string($host) && $host !== '' ? $host : 'OpenAI';
    }

    public function client(): LlmClient
    {
        $provider = $this->provider();
        $key = $this->key();
        $model = $this->model();

        if ($provider === null || $key === null || $model === null) {
            throw new LlmUnavailable;
        }

        return $provider === 'anthropic'
            ? new AnthropicClient($key, $model, $this->baseUrl())
            : new OpenAiCompatibleClient($key, $model, $this->baseUrl());
    }

    private function provider(): ?string
    {
        $provider = config('services.llm.provider');

        return in_array($provider, ['anthropic', 'openai'], true) ? $provider : null;
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
        return $this->filled(config('services.llm.base_url'));
    }

    private function filled(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
