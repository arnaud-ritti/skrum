<?php

namespace App\Support\Llm;

use App\Exceptions\Llm\LlmUnavailable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Laravel\Ai\Ai;
use Laravel\Ai\Exceptions\AiException;
use SensitiveParameter;

class SdkLlmClient implements LlmClient
{
    /** @param array<string, mixed> $configuration */
    public function __construct(#[SensitiveParameter] private array $configuration, private string $model) {}

    public function complete(string $system, string $user): string
    {
        try {
            $response = (new TextGenerationAgent($system))->prompt(
                $user,
                provider: [Ai::build($this->configuration)],
                model: $this->model,
                timeout: Llm::TimeoutSeconds,
            );
        } catch (AiException|ConnectionException|RequestException) {
            throw new LlmUnavailable;
        }

        throw_if(trim($response->text) === '', LlmUnavailable::class);

        return $response->text;
    }
}
