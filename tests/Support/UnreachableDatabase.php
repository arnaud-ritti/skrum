<?php

namespace Tests\Support;

class UnreachableDatabase
{
    /**
     * The default connection, pointed at a port nothing listens on and at a database file in a
     * directory that does not exist: one of the two stops every engine, with or without a server.
     *
     * @return array<string, mixed>
     */
    public static function config(): array
    {
        return [
            ...config('database.connections.'.config('database.default')),
            'url' => null,
            'host' => '127.0.0.1',
            'port' => 1,
            'database' => storage_path('framework/no-such-directory/database.sqlite'),
        ];
    }
}
