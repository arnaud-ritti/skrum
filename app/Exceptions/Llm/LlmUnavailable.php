<?php

namespace App\Support\Llm;

use RuntimeException;

class LlmUnavailable extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The text generator is unavailable.');
    }
}
