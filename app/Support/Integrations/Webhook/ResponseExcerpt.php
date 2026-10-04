<?php

namespace App\Support\Integrations\Webhook;

use Illuminate\Http\Client\Response;

/**
 * The first 2 KB of a receiver's answer (webhook redelivery spec §4.1). Curl
 * still downloads the rest, bounded by the request timeout, but none of it is kept.
 */
class ResponseExcerpt
{
    public const MaxBytes = 2048;

    private string $value = '';

    public function append(string $chunk): void
    {
        $room = self::MaxBytes - strlen($this->value);

        if ($room <= 0) {
            return;
        }

        $this->value .= substr($chunk, 0, $room);
    }

    public function value(): string
    {
        return $this->value;
    }

    /**
     * Faked responses never pass through curl's write callback, so their
     * body stands in for what curl would have collected.
     */
    public function orBodyOf(Response $response): ?string
    {
        $excerpt = $this->value !== '' ? $this->value : substr($response->body(), 0, self::MaxBytes);

        return $excerpt === '' ? null : $excerpt;
    }
}
