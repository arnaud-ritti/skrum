<?php

namespace App\Support\Llm;

use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Promptable;

#[MaxTokens(4096)]
class TextGenerationAgent implements Agent
{
    use Promptable;

    public function __construct(private string $system) {}

    public function instructions(): string
    {
        return $this->system;
    }
}
