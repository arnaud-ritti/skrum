<?php

namespace App\Exceptions\Integrations;

use App\Enums\IntegrationProvider;
use App\Support\Integrations\IntegrationErrors;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * The message is the sanitized provider detail; the previous exception is
 * deliberately dropped because connection errors quote the request URL.
 */
abstract class IntegrationException extends RuntimeException
{
    public function __construct(public IntegrationProvider $provider, ?string $detail = null)
    {
        parent::__construct($detail === null ? '' : IntegrationErrors::sanitize($detail));
    }

    abstract public function status(): int;

    abstract public function userMessage(): string;

    public function detail(): ?string
    {
        return $this->getMessage() === '' ? null : $this->getMessage();
    }

    /**
     * A code the client can branch on, where the translated message is not
     * enough to tell the case apart.
     */
    public function reason(): ?string
    {
        return null;
    }

    public function render(Request $request): JsonResponse
    {
        return response()->json(array_filter([
            'message' => $this->userMessage(),
            'reason' => $this->reason(),
        ], fn (?string $value): bool => $value !== null), $this->status());
    }
}
