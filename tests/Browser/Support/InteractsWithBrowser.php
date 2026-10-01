<?php

namespace Tests\Browser\Support;

use App\Models\User;
use Illuminate\Http\Request;
use InvalidArgumentException;

trait InteractsWithBrowser
{
    protected function signIn(User $user, string $to = '/dashboard'): mixed
    {
        $page = visit('/login');

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
        $page = visit($joinUrl);

        $page->fill('#name', $name)
            ->click('Join')
            ->assertPathIsNot($joinPath);

        return $page;
    }

    protected function awaitRealtime(mixed $page): mixed
    {
        $page->assertAttribute('[data-realtime]', 'data-realtime', 'connected');

        return $page;
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
}
