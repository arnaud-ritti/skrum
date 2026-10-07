<?php

namespace Tests\Browser\Support;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\RateLimiter;
use RuntimeException;

trait CapturesDocs
{
    /** @var array<string, int|string> */
    private const array DocsVisitOptions = [
        'colorScheme' => 'light',
        'locale' => 'en-US',
        'reducedMotion' => 'reduce',
        'deviceScaleFactor' => 2,
    ];

    protected function docsVisit(User $user, string $path): mixed
    {
        RateLimiter::for('login', fn (): Limit => Limit::none());

        return visualSignIn($user, $path, self::DocsVisitOptions)->resize(1440, 900);
    }

    protected function docsOpen(string $path): mixed
    {
        return browserVisit($path, self::DocsVisitOptions)->resize(1440, 900);
    }

    protected function docShot(mixed $page, string $name, string $selector): void
    {
        $candidate = 'docs-'.str_replace('/', '-', $name).'.candidate';
        $tracked = base_path("website/src/assets/screenshots/{$name}.png");

        $page->script(self::SettleScript);

        try {
            $page->screenshotElement($selector, $candidate);
        } catch (RuntimeException $exception) {
            throw new RuntimeException("Could not capture {$selector} as {$name}: {$exception->getMessage()}", previous: $exception);
        }

        File::ensureDirectoryExists(dirname($tracked));

        CaptureFile::replaceWhenPictureDiffers(base_path("tests/Browser/Screenshots/{$candidate}"), $tracked);
    }
}
