<?php

namespace Tests;

use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Support\Facades\Event;
use Tests\Browser\Support\InteractsWithBrowser;

abstract class BrowserTestCase extends TestCase
{
    use InteractsWithBrowser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withVite();

        $assetProblem = self::assetProblem(public_path());

        if ($assetProblem !== null) {
            $this->fail($assetProblem);
        }

        config(['app.locale' => 'en']);

        $this->isolateRequests();
    }

    public static function assetProblem(string $publicPath): ?string
    {
        if (! is_file("{$publicPath}/build/manifest.json")) {
            return 'Browser tests need built assets: public/build/manifest.json is missing. Run `npm run build`, or run the suite with `composer test:browser`.';
        }

        if (is_file("{$publicPath}/hot")) {
            return 'Browser tests cannot use the Vite dev server: public/hot exists. Stop `npm run dev` (or delete public/hot), then run `npm run build`.';
        }

        return null;
    }

    /**
     * Every browser context is served by this one application instance, which
     * would otherwise hand the previous request's user and session attributes
     * to the next context.
     */
    private function isolateRequests(): void
    {
        Event::listen(RequestHandled::class, function (): void {
            resolve('auth')->forgetGuards();
            resolve('session')->driver()->flush();
            $this->app->forgetScopedInstances();
        });
    }
}
