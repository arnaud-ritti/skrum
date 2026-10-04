<?php

it('prints a known appearance into the first-paint script', function (string $appearance) {
    $html = $this->withoutVite()->withUnencryptedCookie('appearance', $appearance)->get(route('login'))->assertOk()->getContent();

    expect($html)->toContain("const appearance = \"{$appearance}\";");
})->with(['light', 'dark', 'system']);

it('falls back to the system appearance for any other cookie value', function (string $appearance) {
    $html = $this->withoutVite()->withUnencryptedCookie('appearance', $appearance)->get(route('login'))->assertOk()->getContent();

    expect($html)->toContain('const appearance = "system";')
        ->not->toContain('<html lang="en" class="dark');
})->with(['\\', "dark';alert(1);'", 'sepia']);
