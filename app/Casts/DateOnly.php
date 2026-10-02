<?php

namespace App\Casts;

use DateTimeInterface;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Database\Eloquent\SerializesCastableAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A calendar day. Eloquent's own date cast writes a date and a time, which an engine
 * without a date type keeps as written; this one writes the day alone.
 *
 * @implements CastsAttributes<Carbon, DateTimeInterface|string>
 */
class DateOnly implements CastsAttributes, SerializesCastableAttributes
{
    private const string Format = 'Y-m-d';

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?Carbon
    {
        if ($value === null) {
            return null;
        }

        return Carbon::createFromFormat('!'.self::Format, substr((string) $value, 0, 10));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Carbon::parse($value)->format(self::Format);
    }

    /**
     * The form Eloquent's date cast gives, so pages and API answers do not change.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function serialize(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $this->get($model, $key, $value, $attributes)?->toJSON();
    }
}
