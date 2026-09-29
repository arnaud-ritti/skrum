<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;

class TrustProxies extends Middleware
{
    /**
     * @return array<int, string>|string|null
     */
    protected function proxies()
    {
        $proxies = config('skrum.trusted_proxies');

        if (! is_string($proxies) || trim($proxies) === '') {
            return null;
        }

        if (trim($proxies) === '*') {
            return '*';
        }

        return array_values(array_filter(array_map('trim', explode(',', $proxies))));
    }
}
