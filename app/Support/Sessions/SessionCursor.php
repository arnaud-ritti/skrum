<?php

namespace App\Support\Sessions;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Throwable;

/**
 * The position of the last row of a page in the order every session list
 * uses: `updated_at` descending, then `id` descending. The activity of a
 * team reads the same pair from `created_at`: its lines never change.
 */
class SessionCursor
{
    private const string TimePattern = '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\z/';

    private const string IdPattern = '/^[0-9a-f-]{36}\z/';

    public function __construct(public CarbonImmutable $updatedAt, public string $id) {}

    public static function parse(?string $value): ?self
    {
        if ($value === null || ! str_contains($value, '|')) {
            return null;
        }

        [$time, $id] = explode('|', $value, 2);

        if (preg_match(self::TimePattern, $time) !== 1) {
            return null;
        }

        if (preg_match(self::IdPattern, $id) !== 1) {
            return null;
        }

        try {
            return new self(CarbonImmutable::parse($time)->utc(), $id);
        } catch (Throwable) {
            return null;
        }
    }

    public static function after(Model $session): self
    {
        return new self(CarbonImmutable::parse($session->getAttribute('updated_at'))->utc(), (string) $session->getKey());
    }

    public static function afterCreated(Model $row): self
    {
        return new self(CarbonImmutable::parse($row->getAttribute('created_at'))->utc(), (string) $row->getKey());
    }

    public function toString(): string
    {
        return "{$this->updatedAt->toIso8601String()}|{$this->id}";
    }
}
