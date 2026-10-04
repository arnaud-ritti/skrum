<?php

namespace App\Http\Controllers;

use App\Support\Status\InstanceStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;

class StatusPagesController extends Controller
{
    /** The page is public and unthrottled: its probes run at most once per this many seconds. */
    private const int CheckCacheSeconds = 10;

    private const string CheckCacheKey = 'skrum.status.check';

    public function show(Request $request, InstanceStatus $instanceStatus): Response
    {
        $components = rescue(
            fn (): array => Cache::remember(self::CheckCacheKey, self::CheckCacheSeconds, fn (): array => $instanceStatus->check()),
            fn (): array => $instanceStatus->check(),
            report: false,
        );

        return response()
            ->view('status', [
                'components' => $components,
                'overall' => $instanceStatus->overall($components),
                'checkedAt' => now('UTC')->format('H:i'),
                'locale' => $this->locale($request),
            ])
            ->header('Cache-Control', 'no-store');
    }

    private function locale(Request $request): string
    {
        if (blank($request->header('Accept-Language'))) {
            return app()->getLocale();
        }

        return (string) $request->getPreferredLanguage(array_unique([app()->getLocale(), ...config('skrum.locales')]));
    }
}
