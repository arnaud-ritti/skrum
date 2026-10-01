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

        [$host, $port] = $hostAndPort;
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

        return new WebhookTarget($url, $host, $port, $addresses[0]);
    }

    /**
     * @return array{0: string, 1: int}|null
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

        $host = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));

        if ($host === '') {
            return null;
        }

        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        if (! self::isAllowedPort($port)) {
            return null;
        }

        return [$host, $port];
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
