<?php

namespace App\Support\Integrations\Linear;

use App\Enums\IntegrationAccess;

class LinearClient
{
    /**
     * @return array<int, string>
     */
    public static function scopesFor(IntegrationAccess $access): array
    {
        return $access === IntegrationAccess::Write ? ['read', 'write'] : ['read'];
    }
}
