<?php

namespace App\Actions\Integrations;

class CreatedIssue
{
    public function __construct(public string $id, public string $key, public string $url) {}
}
