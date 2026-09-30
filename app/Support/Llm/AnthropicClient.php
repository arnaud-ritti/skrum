<?php

namespace App\Support\Llm;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;

class AnthropicClient implements LlmClient
{
    private const MaxTokens = 4096;

    public function __construct(
        #[SensitiveParameter] private string $key,
        private string $model,
        private ?string $baseUrl,
    ) {}

    public function complete(string $system, string $user): string
    {
        try {
            $response = Http::baseUrl(rtrim($this->baseUrl ?? 'https://api.anthropic.com', '/'))
                ->timeout(Llm::TimeoutSeconds)
                ->acceptJson()
                ->withHeaders(['x-api-key' => $this->key, 'anthropic-version' => '2023-06-01'])
                ->post('v1/messages', [
                    'model' => $this->model,
                    'max_tokens' => self::MaxTokens,
                    'system' => $system,
                    'messages' => [['role' => 'user', 'content' => $user]],
                ])
                ->throw();
        } catch (ConnectionException|RequestException) {
            throw new LlmUnavailable;
        }

        $text = $response->json('content.0.text');

        if (! is_string($text)) {
            throw new LlmUnavailable;
        }

        return $text;
    }
}
