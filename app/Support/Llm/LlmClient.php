<?php

namespace App\Support\Llm;

interface LlmClient
{
    /**
     * @throws LlmUnavailable
     */
    public function complete(string $system, string $user): string;
}
