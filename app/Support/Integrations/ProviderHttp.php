<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\ProviderRejected;
use App\Exceptions\Integrations\ProviderUnavailable;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReconnectRequired;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class ProviderHttp
{
    public const DefaultTimeoutSeconds = 15;

    private const int ConnectTimeoutSeconds = 5;

    /**
     * @var array<int, string>
     */
    private const array MessagePaths = ['errorMessages.0', 'message', 'error_description', 'error', 'description', 'errors.0.message'];

    public static function request(int $timeout = self::DefaultTimeoutSeconds): PendingRequest
    {
        return Http::timeout($timeout)
            ->connectTimeout(self::ConnectTimeoutSeconds)
            ->acceptJson();
    }

    /**
     * @param  Closure(): Response  $send
     */
    public static function send(IntegrationProvider $provider, Closure $send): Response
    {
        try {
            return $send();
        } catch (ConnectionException $exception) {
            throw new ProviderUnavailable($provider, $exception->getMessage(), timedOut: true);
        }
    }

    public static function fail(IntegrationProvider $provider, Response $response, ?string $message = null): never
    {
        $detail = $message ?? self::message($response);

        if ($response->status() === 429) {
            throw new RateLimited($provider, self::retryAfter($response), $detail);
        }

        throw_if($response->serverError(), ProviderUnavailable::class, $provider, $detail);

        throw_if($response->status() === 401, ReconnectRequired::class, $provider, $detail);

        $errors = $response->json('errors');

        throw new ProviderRejected($provider, $detail, $response->status(), is_array($errors) ? $errors : []);
    }

    public static function retryAfter(Response $response, int $default = 30): int
    {
        $header = $response->header('Retry-After');

        return is_numeric($header) ? max(1, (int) $header) : $default;
    }

    public static function message(Response $response): string
    {
        $payload = $response->json();

        if (is_array($payload)) {
            foreach (self::MessagePaths as $path) {
                $value = data_get($payload, $path);

                if (is_string($value) && $value !== '') {
                    return $value;
                }
            }
        }

        return "HTTP {$response->status()}";
    }
}
