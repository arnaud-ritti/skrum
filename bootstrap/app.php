<?php

use App\Http\ErrorPageResponder;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\TrustProxies;
use App\Support\Database\Transactions;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Database\DeadlockException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Middleware\TrustProxies as FrameworkTrustProxies;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Route;
use Inertia\ExceptionResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            Route::group([], base_path('routes/webhooks.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);

        $middleware->replace(FrameworkTrustProxies::class, TrustProxies::class);

        $isInboundWebhook = fn (Request $request): bool => $request->is('integrations/webhooks/*');

        $middleware->trimStrings(except: [$isInboundWebhook]);
        $middleware->convertEmptyStringsToNull(except: [$isInboundWebhook]);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);
        $middleware->preventRequestForgery(except: ['reminder-unsubscribe/*', 'recap-unsubscribe/*']);

        $middleware->web(append: [
            HandleAppearance::class,
            SetLocale::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontFlash(['token', 'gif_key']);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*') || $request->expectsJson(),
        );

        $busy = fn (Throwable $exception, Request $request): ?Response => Transactions::isConcurrencyError($exception)
            ? resolve(ExceptionHandler::class)->render($request, new ServiceUnavailableHttpException(1, Transactions::busyMessage(), $exception))
            : null;

        $exceptions->render(fn (QueryException $exception, Request $request): ?Response => $busy($exception, $request));
        $exceptions->render(fn (DeadlockException $exception, Request $request): ?Response => $busy($exception, $request));

        $exceptions->respond(fn (Response $response, Throwable $exception, Request $request): Response => resolve(ErrorPageResponder::class)(
            new ExceptionResponse($exception, $request, $response, resolve(Router::class), resolve(Kernel::class)),
        ) ?? $response);
    })->create();
