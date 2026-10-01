<?php

namespace Tests;

use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithBrowser;
use Tests\Browser\Support\InteractsWithWhiteboards;
use Tests\Browser\Support\ReverbServer;

abstract class BrowserTestCase extends TestCase
{
    use InteractsWithBrowser;
    use InteractsWithWhiteboards;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withVite();

        $assetProblem = self::assetProblem(public_path());

        if ($assetProblem !== null) {
            $this->fail($assetProblem);
        }

        $this->configureBrowserEnvironment();

        ReverbServer::ensureRunning();

        $this->isolateRequests();

        Http::preventStrayRequests();
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

    private function configureBrowserEnvironment(): void
    {
        config([
            'app.locale' => 'en',
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => ReverbServer::AppKey,
            'broadcasting.connections.reverb.secret' => ReverbServer::AppSecret,
            'broadcasting.connections.reverb.app_id' => ReverbServer::AppId,
            'broadcasting.connections.reverb.client.host' => ReverbServer::Host,
            'broadcasting.connections.reverb.client.port' => ReverbServer::Port,
            'broadcasting.connections.reverb.client.scheme' => 'http',
            'broadcasting.connections.reverb.options.host' => ReverbServer::Host,
            'broadcasting.connections.reverb.options.port' => ReverbServer::Port,
            'broadcasting.connections.reverb.options.scheme' => 'http',
            'broadcasting.connections.reverb.options.useTLS' => false,
        ]);

        Broadcast::forgetDrivers();
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
