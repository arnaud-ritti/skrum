<?php

namespace App\Support\Integrations;

use JsonSerializable;

/**
 * A Jira or Linear account. The email is kept for an in-memory comparison
 * and is never serialized.
 */
class ExternalAccount implements JsonSerializable
{
    public function __construct(
        public string $id,
        public string $displayName,
        public bool $active,
        private ?string $email = null,
    ) {}

    public function email(): ?string
    {
        return $this->email;
    }

    /**
     * @return array{accountId: string, displayName: string}
     */
    public function toArray(): array
    {
        return ['accountId' => $this->id, 'displayName' => $this->displayName];
    }

    /**
     * @return array{accountId: string, displayName: string}
     */
    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
