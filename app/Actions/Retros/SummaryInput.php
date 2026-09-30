<?php

namespace App\Actions\Retros;

class SummaryInput
{
    /**
     * @param  array<int, string>  $cardIds  opaque index sent to the provider => card id
     */
    public function __construct(
        public string $instructions,
        public string $payload,
        public array $cardIds,
    ) {}
}
