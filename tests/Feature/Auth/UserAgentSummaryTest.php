<?php

use App\Support\Auth\UserAgentSummary;

it('names the browser of mobile user agents', function (string $userAgent, string $summary) {
    expect(UserAgentSummary::describe($userAgent))->toBe($summary);
})->with([
    'Chrome on an iPhone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1', 'Chrome on iOS'],
    'Firefox on an iPhone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/131.0 Mobile/15E148 Safari/605.1.15', 'Firefox on iOS'],
    'Edge on an iPhone' => ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/129.0.2792.84 Mobile/15E148 Safari/605.1.15', 'Edge on iOS'],
    'Edge on Android' => ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 EdgA/129.0.2792.84', 'Edge on Android'],
]);
