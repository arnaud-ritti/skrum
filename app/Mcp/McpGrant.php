<?php

namespace App\Mcp;

use App\Enums\McpScope;
use App\Models\User;
use RuntimeException;

class McpGrant
{
    /**
     * @param  array<int, McpScope>  $scopes
     */
    public function __construct(
        public User $user,
        public string $tokenId,
        public array $scopes,
        public ?string $teamId,
    ) {}

    public function has(McpScope $scope): bool
    {
        return in_array($scope, $this->scopes, true);
    }

    public function bind(): void
    {
        resolve(McpGrantContext::class)->grant = $this;
    }

    public static function bound(): bool
    {
        return resolve(McpGrantContext::class)->grant !== null;
    }

    public static function current(): self
    {
        return resolve(McpGrantContext::class)->grant
            ?? throw new RuntimeException('No MCP grant is bound to this request.');
    }
}
