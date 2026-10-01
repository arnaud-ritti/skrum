<?php

namespace App\Support\Integrations;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Spec 8 §2.3: whether providers can reach APP_URL with their webhooks.
 */
class InboundReachability
{
    /**
     * @var array<int, string>
     */
    public const Modes = ['auto', 'on', 'off'];

    private const CacheSeconds = 3600;

    /**
     * @var array<int, string>
     */
    private const PrivateSuffixes = ['.local', '.localhost', '.test', '.internal', '.lan', '.home.arpa'];

    public function __construct(private HostResolver $resolver) {}

    public static function mode(): string
    {
        $mode = strtolower((string) config('services.integrations.inbound_webhooks', 'auto'));

        return in_array($mode, self::Modes, true) ? $mode : 'auto';
    }

    public static function pollIntervalMinutes(): int
    {
        return max(1, min(60, (int) config('services.integrations.poll_minutes', 5)));
    }

    public function isPublic(): bool
    {
        return match (self::mode()) {
            'on' => true,
            'off' => false,
            default => $this->appUrlIsPublic(),
        };
    }

    private function appUrlIsPublic(): bool
    {
        $url = (string) config('app.url');

        return Cache::remember(
            'integrations:inbound-public:'.sha1($url),
            self::CacheSeconds,
            fn (): bool => $this->isPublicUrl($url),
        );
    }

    private function isPublicUrl(string $url): bool
    {
        $parts = parse_url($url);

        if (! is_array($parts) || ($parts['scheme'] ?? null) !== 'https') {
            return false;
        }

        $host = strtolower(rtrim((string) ($parts['host'] ?? ''), '.'));

        if ($host === '' || $host === 'localhost') {
            return false;
        }

        if (filter_var(trim($host, '[]'), FILTER_VALIDATE_IP) !== false) {
            return false;
        }

        if (Str::endsWith($host, self::PrivateSuffixes)) {
            return false;
        }

        foreach ($this->resolver->addresses($host) as $address) {
            if (PublicAddress::isPublic($address)) {
                return true;
            }
        }

        return false;
    }
}
