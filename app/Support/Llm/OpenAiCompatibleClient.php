<?php

namespace App\Support\Llm;

use App\Exceptions\Llm\LlmUnavailable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;

class OpenAiCompatibleClient implements LlmClient
{
    public function __construct(
        #[SensitiveParameter] private string $key,
        private string $model,
        private ?string $baseUrl,
    ) {}

    public function complete(string $system, string $user): string
    {
        try {
            $response = Http::baseUrl(rtrim($this->baseUrl ?? 'https://api.openai.com/v1', '/'))
                ->timeout(Llm::TimeoutSeconds)
                ->acceptJson()
                ->withToken($this->key)
                ->post('chat/completions', [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => $system],
                        ['role' => 'user', 'content' => $user],
                    ],
                ])
                ->throw();
        } catch (ConnectionException|RequestException) {
            throw new LlmUnavailable;
        }

        $text = $response->json('choices.0.message.content');

        throw_unless(is_string($text), LlmUnavailable::class);

        return $text;
    }
}
