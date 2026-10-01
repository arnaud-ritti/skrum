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
}
