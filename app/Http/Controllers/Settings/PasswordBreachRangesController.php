<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class PasswordBreachRangesController extends Controller
{
    public const int CacheSeconds = 86400;

    private const string RangeUrl = 'https://api.pwnedpasswords.com/range/';

    /**
     * k-anonymity: the browser sends five characters of the password's SHA-1
     * and compares the answer itself; neither the password nor its hash
     * reaches the instance.
     */
    public function store(Request $request): JsonResponse
    {
        abort_unless(Password::defaults()->appliedRules()['uncompromised'], 404);

        /** @var array{prefix: string} $validated */
        $validated = $request->validate([
            'prefix' => ['required', 'string', 'regex:/^[0-9A-Fa-f]{5}$/D'],
        ]);

        $prefix = Str::upper($validated['prefix']);
        $key = "password-breach-range:{$prefix}";
        $cachedSuffixes = Cache::get($key);

        if (is_array($cachedSuffixes)) {
            return response()->json(['suffixes' => $cachedSuffixes]);
        }

        $suffixes = $this->fetch($prefix);

        if ($suffixes === null) {
            return response()->json(['available' => false], 503);
        }

        Cache::put($key, $suffixes, self::CacheSeconds);

        return response()->json(['suffixes' => $suffixes]);
    }

    /**
     * @return array<int, string>|null
     */
    private function fetch(string $prefix): ?array
    {
        try {
            $response = Http::withHeaders(['Add-Padding' => 'true'])
                ->timeout((int) config('skrum.passwords.breach_check_timeout'))
                ->get(self::RangeUrl.$prefix);
        } catch (ConnectionException $exception) {
            report($exception);

            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        return Str::of($response->body())->trim()->explode("\n")
            ->map(fn (string $line): array => explode(':', trim($line)))
            ->filter(fn (array $parts): bool => count($parts) === 2 && (int) $parts[1] > 0)
            ->map(fn (array $parts): string => Str::upper($parts[0]))
            ->values()
            ->all();
    }
}
