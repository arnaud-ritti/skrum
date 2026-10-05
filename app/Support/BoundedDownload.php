<?php

namespace App\Support;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class BoundedDownload
{
    /**
     * The body is read in chunks so an oversized upstream file is refused
     * without being held in memory in full. A refused type or size answers 502.
     *
     * @param  array<int, string>  $types
     *
     * @throws RequestException
     * @throws ConnectionException
     */
    public static function fetch(string $url, int $maxBytes, array $types, string $failureMessage): string
    {
        $response = Http::timeout(10)->withOptions(['stream' => true])->get($url)->throw();

        $declaredType = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));

        abort_unless(in_array($declaredType, $types, true), 502, $failureMessage);
        abort_if((int) $response->header('Content-Length') > $maxBytes, 502, $failureMessage);

        $stream = $response->toPsrResponse()->getBody();
        $body = '';

        while (! $stream->eof() && strlen($body) <= $maxBytes) {
            $body .= $stream->read(65536);
        }

        abort_if(strlen($body) > $maxBytes, 502, $failureMessage);

        return $body;
    }

    /**
     * Written beside the target and moved into place, so a concurrent
     * first read never finds a partly written file.
     */
    public static function atomicPut(Filesystem $disk, string $path, string $body): void
    {
        $temporaryPath = "{$path}.".Str::random(16).'.tmp';

        $disk->put($temporaryPath, $body);
        $disk->move($temporaryPath, $path);
    }
}
