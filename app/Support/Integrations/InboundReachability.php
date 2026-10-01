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

    private const int CacheSeconds = 3600;

    /**
     * @var array<int, string>
     */
    private const array PrivateSuffixes = ['.local', '.localhost', '.test', '.internal', '.lan', '.home.arpa'];

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
        return $this->publicity() ?? false;
    }

    /**
     * Null while APP_URL's host cannot be resolved in auto mode.
     */
    public function publicity(): ?bool
    {
        return match (self::mode()) {
            'on' => true,
            'off' => false,
            default => $this->appUrlIsPublic(),
        };
    }

    private function appUrlIsPublic(): ?bool
    {
        $url = (string) config('app.url');
        $key = 'integrations:inbound-public:'.hash('xxh128', $url);

        $cached = Cache::get($key);

        if (is_bool($cached)) {
            return $cached;
        }

        $isPublic = $this->isPublicUrl($url);

        if ($isPublic !== null) {
            Cache::put($key, $isPublic, self::CacheSeconds);
        }

        return $isPublic;
    }

    private function isPublicUrl(string $url): ?bool
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

        $addresses = $this->resolver->addresses($host);

        if ($addresses === []) {
            return null;
        }

        foreach ($addresses as $address) {
            if (PublicAddress::isPublic($address)) {
                return true;
            }
        }

        return false;
    }
}
