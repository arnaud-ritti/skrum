<?php

namespace App\Support\Integrations;

use ErrorException;

class HostResolver
{
    /**
     * @return array<int, string>
     */
    public function addresses(string $host): array
    {
        try {
            $records = dns_get_record($host, DNS_A | DNS_AAAA);
        } catch (ErrorException) {
            return [];
        }

        if (! is_array($records)) {
            return [];
        }

        $addresses = [];

        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;

            if (is_string($address)) {
                $addresses[] = $address;
            }
        }

        return array_values(array_unique($addresses));
    }
}
