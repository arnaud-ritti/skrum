<?php

namespace App\Http;

use App\Actions\Teams\PresentAccessRequestOffer;
use App\Actions\Teams\ResolveDeniedTeam;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use App\Models\User;
use App\Support\InstanceVersion;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Http\Request;
use Illuminate\Pipeline\Pipeline;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Auth;
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
                ->render(self::Component, $this->pageProps($response))
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
            'statusUrl' => route('status.show'),
            ...$this->returnTo($response->request),
            ...($this->sessionHoldsUser($response->request) ? $this->version() : []),
        ]);
    }

    /**
     * Whether the failed request belongs to a signed-in user, read from the
     * guard or the session only: the database may be what failed.
     */
    private function sessionHoldsUser(Request $request): bool
    {
        $guard = Auth::guard();

        if ($guard->hasUser()) {
            return true;
        }

        if (! $request->hasSession()) {
            return false;
        }

        return $request->session()->has($guard->getName());
    }

    /**
     * @return array{version?: string}
     */
    private function version(): array
    {
        $version = rescue(fn (): string => resolve(InstanceVersion::class)->current(), null, false);

        return is_string($version) && $version !== '' ? ['version' => $version] : [];
    }

    /**
     * The props of a page rendered with the shared data: the signed-in viewer
     * also gets the version and, on a 403 about a team of their workspace, the
     * offer to ask for access.
     *
     * @return array<string, mixed>
     */
    private function pageProps(ExceptionResponse $response): array
    {
        $request = $response->request;
        $viewer = rescue(fn (): mixed => $request->user(), null, false);

        if (! $viewer instanceof User) {
            return $this->props($response);
        }

        return [
            ...$this->props($response),
            ...$this->version(),
            ...($response->statusCode() === 403 ? $this->accessRequest($request, $viewer) : []),
        ];
    }

    /**
     * @return array{accessRequest?: array<string, mixed>}
     */
    private function accessRequest(Request $request, User $viewer): array
    {
        $offer = rescue(function () use ($request, $viewer): ?array {
            $team = resolve(ResolveDeniedTeam::class)->handle($request);

            return $team === null ? null : resolve(PresentAccessRequestOffer::class)->handle($viewer, $team);
        }, null, false);

        return is_array($offer) ? ['accessRequest' => $offer] : [];
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
     *     statusUrl: string,
     *     retryAfter?: int,
     *     returnTo?: string
     * }
     */
    private function props(ExceptionResponse $response): array
    {
        $props = [
            'status' => $response->statusCode(),
            'statusUrl' => route('status.show'),
            ...$this->returnTo($response->request),
        ];
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
