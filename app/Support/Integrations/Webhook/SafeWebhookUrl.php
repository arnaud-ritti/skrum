<?php

namespace App\Support\Integrations\Webhook;

use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\PublicAddress;

/**
 * Spec 8 §4.5: checked on save and before every send. Every address the
 * host resolves to must be public, unless the instance allows private
 * networks; IP literals are checked as they are.
 */
class SafeWebhookUrl
{
    private const MaxLength = 2048;

    private const MinUnprivilegedPort = 1024;

    private const MaxPort = 65535;

    /**
     * @var array<int, int>
     */
    private const StandardPorts = [80, 443];

    public function __construct(private HostResolver $resolver) {}

    public static function hasAllowedShape(string $url): bool
    {
        return self::hostAndPort($url) !== null;
    }

    public function resolve(string $url): WebhookTarget
    {
        $hostAndPort = self::hostAndPort($url);

        if ($hostAndPort === null) {
            throw new UnsafeWebhookUrl;
        }

        [$host, $port, $urlHost] = $hostAndPort;
        $addresses = filter_var($host, FILTER_VALIDATE_IP) !== false ? [$host] : $this->resolver->addresses($host);

        if ($addresses === []) {
            throw new UnsafeWebhookUrl;
        }

        if (! self::allowsPrivateNetworks()) {
            foreach ($addresses as $address) {
                if (! PublicAddress::isPublic($address)) {
                    throw new UnsafeWebhookUrl;
                }
            }
        }

        return new WebhookTarget($url, $host, $port, self::preferredAddress($addresses), $urlHost);
    }

    /**
     * @param  array<int, string>  $addresses
     */
    private static function preferredAddress(array $addresses): string
    {
        foreach ($addresses as $address) {
            if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false) {
                return $address;
            }
        }

        return $addresses[0];
    }

    /**
     * Hosts such as `2130706433`, `0x7f.1` or `127.1` are IPv4 addresses to
     * curl but not to PHP, and curl ignores the pin for them.
     */
    private static function endsInNumber(string $host): bool
    {
        return preg_match('/(^|\.)(0x[0-9a-f]*|[0-9]+)$/', $host) === 1;
    }

    /**
     * @return array{0: string, 1: int, 2: string}|null
     */
    private static function hostAndPort(string $url): ?array
    {
        if (strlen($url) > self::MaxLength || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        $parts = parse_url($url);

        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));

        if (! in_array($scheme, self::allowedSchemes(), true)) {
            return null;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $urlHost = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));
        $host = rtrim($urlHost, '.');

        if ($host === '' || str_contains($host, '..')) {
            return null;
        }

        if (filter_var($host, FILTER_VALIDATE_IP) === false && self::endsInNumber($host)) {
            return null;
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (! self::isAllowedPort($port)) {
            return null;
        }

        return [$host, $port, $urlHost];
    }

    /**
     * @return array<int, string>
     */
    private static function allowedSchemes(): array
    {
        return config('services.outgoing_webhooks.allow_http') === true ? ['https', 'http'] : ['https'];
    }

    private static function isAllowedPort(int $port): bool
    {
        if (in_array($port, self::StandardPorts, true)) {
            return true;
        }

        return $port >= self::MinUnprivilegedPort && $port <= self::MaxPort;
    }

    private static function allowsPrivateNetworks(): bool
    {
        return config('services.outgoing_webhooks.allow_private_networks') === true;
    }
}
