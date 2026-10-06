<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::get('/_proxy-check', fn (Request $request) => $request->isSecure() ? 'https' : 'http');
});

it('trusts every proxy when the environment names none', function () {
    $previous = getenv('TRUSTED_PROXIES');
    $previousServer = $_SERVER;
    $previousEnv = $_ENV;
    putenv('TRUSTED_PROXIES');
    unset($_SERVER['TRUSTED_PROXIES'], $_ENV['TRUSTED_PROXIES']);

    try {
        $config = require config_path('skrum.php');
    } finally {
        putenv($previous === false ? 'TRUSTED_PROXIES' : "TRUSTED_PROXIES={$previous}");
        $_SERVER = $previousServer;
        $_ENV = $previousEnv;
    }

    expect($config['trusted_proxies'])->toBe('*');
});

it('ignores forwarded headers when no proxy is trusted', function (?string $configured) {
    config(['skrum.trusted_proxies' => $configured]);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('http');
})->with(['the word none' => ['none'], 'the word in capitals' => [' None '], 'an empty value' => [''], 'no value' => [null]]);

it('honours forwarded https from any proxy when all proxies are trusted', function () {
    config(['skrum.trusted_proxies' => '*']);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('https');
});

it('only honours forwarded headers from listed proxy addresses', function () {
    config(['skrum.trusted_proxies' => '10.0.0.1, 10.0.0.2']);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('http');

    $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])
        ->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])
        ->assertContent('https');
});
