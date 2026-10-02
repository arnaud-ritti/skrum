<?php

namespace App\Support\Database;

use Illuminate\Support\Str;

class NameKey
{
    /**
     * The form a name is compared by. Computed in PHP so that every engine stores the same key.
     */
    public static function of(string $name): string
    {
        return Str::lower(trim($name));
    }
}
