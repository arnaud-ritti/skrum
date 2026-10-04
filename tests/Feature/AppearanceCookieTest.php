<?php

it('falls back to the system appearance when the cookie holds anything else', function (string $cookie) {
    $this->withUnencryptedCookie('appearance', $cookie)
        ->get(route('login'))
        ->assertOk()
        ->assertSee("const appearance = 'system';", false);
})->with([
    'a backslash' => ['\\'],
    'an unknown word' => ['sepia'],
]);

it('keeps a known appearance from the cookie', function () {
    $this->withUnencryptedCookie('appearance', 'dark')
        ->get(route('login'))
        ->assertOk()
        ->assertSee("const appearance = 'dark';", false);
});
