<?php

namespace Tests\Browser\Support;

use App\Models\User;

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
     * dnd-kit's keyboard sensor starts listening one timer turn after the pick-up and reads
     * the drop target only once React has rendered the move, so each key waits for the page.
     *
     * @param  array<int, string>  $keys
     */
    protected function dragWithKeyboard(mixed $page, string $handleSelector, array $keys): mixed
    {
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
        $page->assertAttributeMissing($handleSelector, 'aria-pressed');

        return $page;
    }
}
