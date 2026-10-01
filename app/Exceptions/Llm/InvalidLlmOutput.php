<?php

namespace App\Support\Llm;

use RuntimeException;

class InvalidLlmOutput extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The text generator returned an unusable answer.');
    }
}
