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
     * give its error page the session, the signed-in user and the locale.
     *
     * @var array<int, class-string>
     */
    private const array UnroutedMiddleware = [
        EncryptCookies::class,
        StartSession::class,
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
            return $this->throughUnroutedMiddleware($response->request, fn (): Response => $response
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
     *     retryAfter?: int
     * }
     */
    private function props(ExceptionResponse $response): array
    {
        $retryAfter = $response->response->headers->get('Retry-After');

        if ($response->statusCode() !== 429 || ! is_numeric($retryAfter)) {
            return ['status' => $response->statusCode()];
        }

        return ['status' => 429, 'retryAfter' => (int) $retryAfter];
    }

    /**
     * @param  callable(): Response  $render
     */
    private function throughUnroutedMiddleware(Request $request, callable $render): Response
    {
        if ($request->route() !== null) {
            return $render();
        }

        return resolve(Pipeline::class)
            ->send($request)
            ->through(self::UnroutedMiddleware)
            ->then(fn (): Response => $render());
    }
}
