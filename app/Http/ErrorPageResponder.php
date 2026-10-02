<?php

namespace App\Http;

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Http\Request;
use Illuminate\Pipeline\Pipeline;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Context;
use Inertia\ExceptionResponse;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Renders the design-system error page for an HTML request. JSON requests keep
 * their body, and the 503 page is the static view `errors.503`.
 */
class ErrorPageResponder
{
    public const string Component = 'errors/error';

    /** @var array<int, int> */
    public const array Statuses = [403, 404, 419, 429, 500];

    /**
     * A request that matched no route went through no route middleware: these
     * give its error page the session and the signed-in user.
     *
     * @var array<int, class-string>
     */
    private const array SessionMiddleware = [
        EncryptCookies::class,
        StartSession::class,
    ];

    /**
     * The web group runs these after the bindings, the CSRF check and the
     * throttle, so an error thrown there has not been through them yet.
     *
     * @var array<int, class-string>
     */
    private const array PageMiddleware = [
        HandleAppearance::class,
        SetLocale::class,
    ];

    public function __construct(private HandleInertiaRequests $inertia) {}

    public function __invoke(ExceptionResponse $response): ?Response
    {
        $status = $response->statusCode();

        if (! in_array($status, self::Statuses, true)) {
            return null;
        }

        if ($response->request->is('api/*') || $response->request->expectsJson()) {
            return null;
        }

        if ($status === 500) {
            return $this->serverError($response);
        }

        try {
            return $this->throughPageMiddleware($response->request, fn (): Response => $response
                ->render(self::Component, $this->props($response))
                ->usingMiddleware(HandleInertiaRequests::class)
                ->withSharedData()
                ->toResponse($response->request));
        } catch (Throwable $failure) {
            report($failure);

            return $this->withoutSharedData($response, $this->props($response));
        }
    }

    private function serverError(ExceptionResponse $response): ?Response
    {
        if (app()->hasDebugModeEnabled()) {
            return null;
        }

        return $this->withoutSharedData($response, [
            'status' => 500,
            'requestId' => Context::get(AssignRequestId::ContextKey),
            'occurredAt' => now('UTC')->format('Y-m-d H:i:s'),
            ...$this->returnTo($response->request),
        ]);
    }

    /**
     * The page without any prop read from the database. The shared props of the
     * failed request are dropped: one of them may be what failed.
     *
     * @param  array<string, mixed>  $props
     */
    private function withoutSharedData(ExceptionResponse $response, array $props): ?Response
    {
        $request = $response->request;

        try {
            Inertia::flushShared();
            Inertia::setRootView($this->inertia->rootView($request));
            Inertia::version(fn (): ?string => $this->inertia->version($request));

            return Inertia::render(self::Component, [
                ...$props,
                'locale' => app()->getLocale(),
                'translations' => (object) $this->inertia->translations(app()->getLocale()),
            ])->toResponse($request)->setStatusCode($response->statusCode());
        } catch (Throwable $failure) {
            report($failure);

            return null;
        }
    }

    /**
     * @return array{
     *     status: int,
     *     retryAfter?: int,
     *     returnTo?: string
     * }
     */
    private function props(ExceptionResponse $response): array
    {
        $props = ['status' => $response->statusCode(), ...$this->returnTo($response->request)];
        $retryAfter = $response->response->headers->get('Retry-After');

        if ($response->statusCode() !== 429 || ! is_numeric($retryAfter)) {
            return $props;
        }

        return [...$props, 'retryAfter' => (int) $retryAfter];
    }

    /**
     * The page is shown at the URL of the failed request. When that request was
     * not a GET, reloading it would ask for a URL that may only answer a POST:
     * its actions go back to the page the request came from instead.
     *
     * @return array{returnTo?: string}
     */
    private function returnTo(Request $request): array
    {
        if ($request->isMethodSafe()) {
            return [];
        }

        $root = $request->getSchemeAndHttpHost();
        $previous = url()->previous();

        if ($previous !== $root && ! str_starts_with($previous, "{$root}/")) {
            return ['returnTo' => "{$root}/"];
        }

        return ['returnTo' => $previous];
    }

    /**
     * @param  callable(): Response  $render
     */
    private function throughPageMiddleware(Request $request, callable $render): Response
    {
        return resolve(Pipeline::class)
            ->send($request)
            ->through([
                ...($this->shouldStartSession($request) ? self::SessionMiddleware : []),
                ...self::PageMiddleware,
            ])
            ->then(fn (): Response => $render());
    }

    /**
     * Bots, missing assets and stale build chunks get their 404 without a
     * session row, a cookie or the queries of a signed-in user.
     */
    private function shouldStartSession(Request $request): bool
    {
        if ($request->route() !== null) {
            return false;
        }

        if (! $request->cookies->has(config('session.cookie'))) {
            return false;
        }

        return str_contains((string) $request->header('Accept'), 'text/html');
    }
}
