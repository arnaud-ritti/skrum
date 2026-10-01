<?php

namespace App\Support\Llm;

use App\Exceptions\Llm\LlmUnavailable;

interface LlmClient
{
    /**
     * @throws LlmUnavailable
     */
    public function complete(string $system, string $user): string;
}
