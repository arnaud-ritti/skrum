<?php

use Illuminate\Support\Facades\File;
use Tests\BrowserTestCase;

beforeEach(function () {
    $this->publicPath = sys_get_temp_dir().'/skrum-browser-assets-'.bin2hex(random_bytes(4));

    File::ensureDirectoryExists("{$this->publicPath}/build");
});

afterEach(function () {
    File::deleteDirectory($this->publicPath);
});

it('reports a missing Vite manifest', function () {
    expect(BrowserTestCase::assetProblem($this->publicPath))
        ->toBe('Browser tests need built assets: public/build/manifest.json is missing. Run `npm run build`, or run the suite with `composer test:browser`.');
});

it('reports a running Vite dev server', function () {
    File::put("{$this->publicPath}/build/manifest.json", '{}');
    File::put("{$this->publicPath}/hot", 'http://localhost:5173');

    expect(BrowserTestCase::assetProblem($this->publicPath))
        ->toBe('Browser tests cannot use the Vite dev server: public/hot exists. Stop `npm run dev` (or delete public/hot), then run `npm run build`.');
});

it('accepts built assets', function () {
    File::put("{$this->publicPath}/build/manifest.json", '{}');

    expect(BrowserTestCase::assetProblem($this->publicPath))->toBeNull();
});
