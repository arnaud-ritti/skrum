<?php

use App\Support\Auth\UserAgentSummary;

it('tells the kind of device from the user agent', function (?string $userAgent, string $kind) {
    expect(UserAgentSummary::deviceKind($userAgent))->toBe($kind);
})->with([
    'Firefox on a Mac' => ['Mozilla/5.0 (Macintosh; Intel Mac OS X 15.0; rv:131.0) Gecko/20100101 Firefox/131.0', 'desktop'],
    'Safari on an iPhone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'phone'],
    'Chrome on Android' => ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', 'phone'],
    'curl' => ['curl/8.0', 'unknown'],
    'no header' => [null, 'unknown'],
]);
