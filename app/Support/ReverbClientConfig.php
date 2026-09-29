<?php

namespace App\Support;

class ReverbClientConfig
{
    /**
     * @return array{
     *     key: ?string,
     *     host: ?string,
     *     port: ?int,
     *     scheme: ?string
     * }
     */
    public static function toArray(): array
    {
        $key = config('broadcasting.connections.reverb.key');
        $host = config('broadcasting.connections.reverb.client.host');
        $port = config('broadcasting.connections.reverb.client.port');
        $scheme = config('broadcasting.connections.reverb.client.scheme');

        return [
            'key' => is_string($key) && $key !== '' ? $key : null,
            'host' => is_string($host) && $host !== '' ? $host : null,
            'port' => is_numeric($port) ? (int) $port : null,
            'scheme' => is_string($scheme) && $scheme !== '' ? $scheme : null,
        ];
    }
}
