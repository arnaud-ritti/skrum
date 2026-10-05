<?php

namespace Tests\Browser\Support;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

trait InteractsWithBrowser
{
    /**
     * @param  array<string, mixed>  $options  the options of visit(), such as colorScheme or locale
     */
    protected function signIn(User $user, string $to = '/dashboard', array $options = []): mixed
    {
        $page = $this->recordEveryResource(visit('/login', $options));

        $page->fill('#email', $user->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        $page->navigate($to);

        return $page;
    }

    protected function joinAsGuest(string $joinUrl, string $name): mixed
    {
        $joinPath = (string) parse_url($joinUrl, PHP_URL_PATH);
        $page = $this->recordEveryResource(visit($joinUrl));

        $page->fill('#name', $name)
            ->click('Join the session')
            ->assertPathIsNot($joinPath);

        return $page;
    }

    /**
     * A built page loads some 250 script chunks, the default size of the resource timing buffer, so later requests
     * (the snapshot awaitResync looks for) would be dropped: the buffer grows for this document and every later one.
     */
    private function recordEveryResource(mixed $page): mixed
    {
        $growBuffer = 'performance.setResourceTimingBufferSize(10000)';

        $page->page()->context()->addInitScript($growBuffer);
        $page->script("() => {$growBuffer}");

        return $page;
    }

    protected function awaitRealtime(mixed $page): mixed
    {
        $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected');

        return $page;
    }

    /**
     * A live page (retro board, poker game, game room) refetches its snapshot about 250 ms after its presence subscription.
     * A test that changes the database behind an open page calls this first, so that this refetch cannot bring the change to the page.
     * It is true once the page has received a snapshot since its last load, whatever caused it.
     */
    protected function awaitResync(mixed $page): mixed
    {
        $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.includes('/snapshot') && entry.responseEnd > 0)", true);
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');

        return $page;
    }

    /**
     * Fetches a same-origin path from inside the page, so the request carries that context's session or guest cookie
     * and the answer is what the server sends to that viewer now (a scan of the document only proves what the page rendered).
     *
     * @return array<string, mixed>
     */
    protected function snapshotOf(mixed $page, string $snapshotPath): array
    {
        $path = json_encode($snapshotPath, JSON_THROW_ON_ERROR);

        $answer = json_decode(
            (string) $page->script("() => fetch({$path}, { headers: { Accept: 'application/json' } }).then((response) => response.text().then((body) => JSON.stringify({ status: response.status, body })))"),
            true,
            flags: JSON_THROW_ON_ERROR,
        );

        throw_unless($answer['status'] === 200, RuntimeException::class, "snapshotOf() got HTTP {$answer['status']} for {$snapshotPath}.");

        return json_decode((string) $answer['body'], true, flags: JSON_THROW_ON_ERROR);
    }

    /**
     * Runs $jobs queued jobs, each outside any browser request, so a broadcast made by the job reaches every open page.
     * A job that fails does not fail the helper (it is released or marked as failed, as a worker would do): callers assert the outcome.
     */
    protected function workQueue(int $jobs = 1): void
    {
        for ($job = 0; $job < $jobs; $job++) {
            $this->app->instance('request', Request::create(url('/')));

            $this->artisan('queue:work', ['--once' => true, '--sleep' => 0])->assertSuccessful();
        }
    }

    /**
     * Runs the queued jobs that are due until none is left: a job that keeps queueing itself fails the test instead of hanging it.
     */
    protected function workDueJobs(int $maxJobs = 50): void
    {
        for ($worked = 0; $this->dueJobs() > 0; $worked++) {
            expect($worked)->toBeLessThan($maxJobs, "More than {$maxJobs} queued jobs ran: a job keeps queueing itself.");

            $this->workQueue();
        }
    }

    protected function dueJobs(): int
    {
        return DB::table('jobs')
            ->whereNull('reserved_at')
            ->where('available_at', '<=', now()->getTimestamp())
            ->count();
    }

    /**
     * dnd-kit's keyboard sensor starts listening one timer turn after the pick-up and reads
     * the drop target only once React has rendered the move, so each key waits for the page.
     *
     * $handleRemains = false: the drop removes the handle (e.g. grouping a card), so the helper
     * ends by asserting the handle is gone instead of asserting aria-pressed is cleared.
     *
     * @param  array<int, string>  $keys
     */
    protected function dragWithKeyboard(mixed $page, string $handleSelector, array $keys, bool $handleRemains = true): mixed
    {
        throw_if(count($keys) < 2, InvalidArgumentException::class, 'dragWithKeyboard() needs at least two keys: the first picks the item up and the last drops it.');

        $pickUp = array_shift($keys);
        $drop = array_pop($keys);

        $page->keys($handleSelector, $pickUp);
        $page->assertAttribute($handleSelector, 'aria-pressed', 'true');
        $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');

        foreach ($keys as $key) {
            $page->keys($handleSelector, $key);
            $page->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
        }

        $page->keys($handleSelector, $drop);

        if (! $handleRemains) {
            $page->assertNotPresent($handleSelector);

            return $page;
        }

        $page->assertAttributeMissing($handleSelector, 'aria-pressed');

        return $page;
    }

    /**
     * Opens a multi-select listbox from its trigger, flips one option and closes it again,
     * asserting the option's aria-checked changed.
     */
    protected function toggleListboxOption(mixed $page, string $triggerSelector, string $option): mixed
    {
        $optionSelector = "[role=\"listbox\"] [role=\"option\"]:has-text(\"{$option}\")";

        $page->click($triggerSelector)
            ->assertPresent('[role="listbox"]');

        $expectedChecked = $page->attribute($optionSelector, 'aria-checked') === 'true' ? 'false' : 'true';

        $page->click($optionSelector)
            ->assertAttribute($optionSelector, 'aria-checked', $expectedChecked)
            ->keys($triggerSelector, 'Escape')
            ->assertNotPresent('[role="listbox"]');

        return $page;
    }

    /**
     * Writes a file the browser attaches under its own name, in a folder of this test alone
     * (parallel shards never share it), removed when the test ends, whether it passed or not.
     */
    protected function temporaryFile(string $name, string $contents): string
    {
        $directory = sys_get_temp_dir().'/skrum-browser-'.Str::random(12);

        File::ensureDirectoryExists($directory);
        File::put("{$directory}/{$name}", $contents);

        $this->beforeApplicationDestroyed(fn (): bool => File::deleteDirectory($directory));

        return "{$directory}/{$name}";
    }

    /**
     * The HTTP server of the browser plugin hands no uploaded file to Laravel: the
     * multipart body is read here, so that a real upload reaches the controller.
     */
    protected function acceptUploads(): void
    {
        resolve(HttpKernel::class)->prependMiddleware(function (Request $request, Closure $next): mixed {
            $contentType = (string) $request->headers->get('content-type');

            if (preg_match('/^multipart\/form-data;.*boundary=("?)([^";]+)\1/i', $contentType, $boundary) !== 1) {
                return $next($request);
            }

            $paths = [];

            foreach (explode('--'.$boundary[2], (string) $request->getContent()) as $part) {
                if (preg_match('/name="([^"]+)"; filename="([^"]+)"/', $part, $names) !== 1) {
                    continue;
                }

                $path = (string) tempnam(sys_get_temp_dir(), 'upload');
                $paths[] = $path;

                file_put_contents($path, substr(explode("\r\n\r\n", $part, 2)[1], 0, -2));

                $request->files->set($names[1], new UploadedFile($path, $names[2], test: true));
            }

            $response = $next($request);

            File::delete($paths);

            return $response;
        });
    }
}
