<?php

namespace App\Support\Integrations;

/**
 * A Jira or Linear account. The email is kept for an in-memory comparison
 * and is never serialized.
 */
class ExternalAccount
{
    public function __construct(
        public string $id,
        public string $displayName,
        public bool $active,
        public ?string $email = null,
    ) {}

    /**
     * @return array{accountId: string, displayName: string}
     */
    public function toArray(): array
    {
        return ['accountId' => $this->id, 'displayName' => $this->displayName];
    }
}
