<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(function () {
    Route::get('/_proxy-check', fn (Request $request) => $request->isSecure() ? 'https' : 'http');
});

it('ignores forwarded headers when no proxy is trusted', function () {
    config(['skrum.trusted_proxies' => null]);

    $this->get('/_proxy-check', ['X-Forwarded-Proto' => 'https'])->assertContent('http');
});

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
