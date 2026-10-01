<?php

namespace App\Exceptions\Integrations;

use App\Enums\IntegrationProvider;

class ProviderRejected extends IntegrationException
{
    /**
     * @param  array<array-key, mixed>  $errors  the provider's structured errors (Jira field map, GraphQL error list)
     */
    public function __construct(IntegrationProvider $provider, string $detail, public int $httpStatus = 422, public array $errors = [])
    {
        parent::__construct($provider, $detail);
    }

    public function status(): int
    {
        return 422;
    }

    public function userMessage(): string
    {
        return $this->detail() ?? __(':provider refused the request.', ['provider' => $this->provider->label()]);
    }
}
