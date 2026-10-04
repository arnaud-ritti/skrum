<?php

namespace Tests\Concurrency\Support;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Concurrency;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Sleep;
use LogicException;
use Throwable;

/**
 * Runs contenders at the same instant, each in its own PHP process with its own connection
 * (Laravel's process concurrency driver). Each contender pauses once, 200 ms after its first
 * query inside a transaction (or its first query at all): with a lock the others queue behind
 * it; without one, they have all read the same state by the time the first one writes.
 *
 * A contender must be a static closure that captures scalars only: it is serialised.
 */
class Race
{
    public const string FirstQueryInTransaction = 'transaction';

    public const string FirstQuery = 'any';

    public const string NoPause = 'none';

    private const string FragmentPrefix = 'fragment:';

    private const int PauseMicroseconds = 200_000;

    /**
     * Pauses after the first query whose SQL holds the fragment (a column name), in a transaction or not: for a write
     * that is checked before its transaction opens, or that has none.
     */
    public static function firstQueryMentioning(string $fragment): string
    {
        return self::FragmentPrefix.$fragment;
    }

    /**
     * @param  array<int|string, Closure(): mixed>  $contenders
     * @return array<int|string, array{ok: bool, value: mixed, error: ?string, message: ?string, startedAt: float, endedAt: float}>
     */
    public static function run(array $contenders, string $pauseAfter = self::FirstQueryInTransaction): array
    {
        $startAt = microtime(true) + (float) env('RACE_LEAD_SECONDS', 4);
        $tasks = [];

        foreach ($contenders as $key => $contender) {
            $portable = self::withoutTestScope($contender);
            $tasks[$key] = static fn (): array => Race::contend($portable, $startAt, $pauseAfter);
        }

        return Concurrency::driver('process')->run($tasks);
    }

    /**
     * A closure written in a Pest file is scoped to the class Pest generates for that file,
     * which the contender's process does not load: the scope is moved to this class.
     */
    private static function withoutTestScope(Closure $contender): Closure
    {
        $portable = Closure::bind($contender, null, self::class);

        throw_if($portable === null, LogicException::class, 'A contender must be a static closure that captures scalars only.');

        return $portable;
    }

    /**
     * Runs in the contender's own process.
     *
     * @return array{ok: bool, value: mixed, error: ?string, message: ?string, startedAt: float, endedAt: float}
     */
    public static function contend(Closure $contender, float $startAt, string $pauseAfter): array
    {
        $paused = $pauseAfter === self::NoPause;

        DB::listen(function (QueryExecuted $query) use (&$paused, $pauseAfter): void {
            if ($paused) {
                return;
            }

            if ($pauseAfter === self::FirstQueryInTransaction && DB::transactionLevel() === 0) {
                return;
            }

            if (str_starts_with($pauseAfter, self::FragmentPrefix) && ! str_contains($query->sql, substr($pauseAfter, strlen(self::FragmentPrefix)))) {
                return;
            }

            $paused = true;

            Sleep::usleep(self::PauseMicroseconds);
        });

        DB::connection()->getPdo();

        $wait = (int) (($startAt - microtime(true)) * 1_000_000);

        if ($wait > 0) {
            Sleep::usleep($wait);
        }

        $startedAt = microtime(true);

        try {
            $value = $contender();
        } catch (Throwable $exception) {
            return ['ok' => false, 'value' => null, 'error' => $exception::class, 'message' => $exception->getMessage(), 'startedAt' => $startedAt, 'endedAt' => microtime(true)];
        }

        return ['ok' => true, 'value' => $value, 'error' => null, 'message' => null, 'startedAt' => $startedAt, 'endedAt' => microtime(true)];
    }

    /**
     * A file path for `holdFirstTransaction()` and `awaitHeldTransaction()`: the contenders share the machine.
     */
    public static function signal(): string
    {
        return sys_get_temp_dir().'/race-'.bin2hex(random_bytes(8));
    }

    /**
     * Called by one contender before its work, with `Race::run(..., Race::NoPause)`: after its first query inside a
     * transaction (its lock), it raises the signal and holds the transaction, so that the contenders waiting for the
     * signal arrive while it runs.
     */
    public static function holdFirstTransaction(string $signal, int $holdMicroseconds = 300_000): void
    {
        DB::listen(static function () use ($signal, $holdMicroseconds): void {
            if (DB::transactionLevel() === 0 || file_exists($signal)) {
                return;
            }

            touch($signal);
            Sleep::usleep($holdMicroseconds);
        });
    }

    /**
     * Waits until the contender that holds its first transaction raised the signal (ten seconds at most).
     */
    public static function awaitHeldTransaction(string $signal): void
    {
        $deadline = microtime(true) + 10;

        while (! file_exists($signal) && microtime(true) < $deadline) {
            Sleep::usleep(5_000);
        }
    }

    /**
     * Sends a JSON request through the HTTP kernel of the contender's process, as the given user,
     * and returns the status: a contender reports what a client would see.
     *
     * @param  array<string, mixed>  $payload
     */
    public static function request(?string $userId, string $method, string $uri, array $payload = []): int
    {
        return self::response($userId, $method, $uri, $payload)['status'];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{
     *     status: int,
     *     headers: array<string, string>
     * }
     */
    public static function response(?string $userId, string $method, string $uri, array $payload = []): array
    {
        if ($userId !== null) {
            Auth::guard('web')->setUser(User::query()->findOrFail($userId));
        }

        $request = Request::create($uri, $method, $payload, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], (string) json_encode($payload));

        $response = resolve(Kernel::class)->handle($request);

        return [
            'status' => $response->getStatusCode(),
            'headers' => array_map(fn (array $values): string => (string) ($values[0] ?? ''), $response->headers->all()),
        ];
    }
}
