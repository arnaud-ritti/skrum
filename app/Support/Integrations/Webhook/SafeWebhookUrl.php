<?php

namespace App\Support\Integrations\Webhook;

use App\Support\Integrations\Exceptions\UnresolvableWebhookHost;
use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\HostResolver;
use App\Support\Integrations\PublicAddress;
use GuzzleHttp\Psr7\Exception\MalformedUriException;
use GuzzleHttp\Psr7\Uri;

/**
 * Spec 8 §4.5: checked on save and before every send. Every address the
 * host resolves to must be public, unless the instance allows private
 * networks; IP literals are checked as they are.
 */
class SafeWebhookUrl
{
    private const int MaxLength = 2048;

    private const int MinUnprivilegedPort = 1024;

    private const int MaxPort = 65535;

    /**
     * @var array<int, int>
     */
    private const array StandardPorts = [80, 443];

    public function __construct(private HostResolver $resolver) {}

    public static function hasAllowedShape(string $url): bool
    {
        return self::hostAndPort($url) !== null;
    }

    public function resolve(string $url): WebhookTarget
    {
        $hostAndPort = self::hostAndPort($url);

        throw_if($hostAndPort === null, UnsafeWebhookUrl::class);

        [$host, $port, $urlHost] = $hostAndPort;
        $addresses = filter_var($host, FILTER_VALIDATE_IP) !== false ? [$host] : $this->resolver->addresses($host);

        throw_if($addresses === [], UnresolvableWebhookHost::class);

        if (! $this->allowsPrivateNetworks()) {
            foreach ($addresses as $address) {
                throw_unless(PublicAddress::isPublic($address), UnsafeWebhookUrl::class);
            }
        }

        return new WebhookTarget($url, $host, $port, $this->preferredAddress($addresses), $urlHost);
    }

    /**
     * @param  array<int, string>  $addresses
     */
    private function preferredAddress(array $addresses): string
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

        if (self::hasMalformedPort($url)) {
            return null;
        }

        try {
            new Uri($url);
        } catch (MalformedUriException) {
            return null;
        }

        $urlHost = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));
        $host = rtrim($urlHost, '.');

        if (filter_var($host, FILTER_VALIDATE_IP) !== false && $urlHost !== $host) {
            return null;
        }

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

    private static function hasMalformedPort(string $url): bool
    {
        if (preg_match('~^[a-z][a-z0-9+.-]*://([^/?#]*)~i', $url, $matches) !== 1) {
            return true;
        }

        $authority = $matches[1];

        if (str_starts_with($authority, '[')) {
            $closingBracket = strpos($authority, ']');

            if ($closingBracket === false) {
                return true;
            }

            $portPart = substr($authority, $closingBracket + 1);

            return $portPart !== '' && preg_match('/^:\d+$/', $portPart) !== 1;
        }

        $colon = strrpos($authority, ':');

        if ($colon === false) {
            return false;
        }

        return preg_match('/^\d+$/', substr($authority, $colon + 1)) !== 1;
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

    private function allowsPrivateNetworks(): bool
    {
        return config('services.outgoing_webhooks.allow_private_networks') === true;
    }
}
