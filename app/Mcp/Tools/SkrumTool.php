<?php

namespace App\Mcp\Tools;

use App\Enums\McpScope;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\McpGrant;
use App\Support\Integrations\Exceptions\IntegrationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tool;
use Laravel\Mcp\Support\ValidationMessages;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

abstract class SkrumTool extends Tool
{
    protected const DefaultLimit = 20;

    abstract protected function requiredScope(): McpScope;

    abstract protected function run(Request $request): Response|ResponseFactory;

    protected function requiredFeature(): ?McpFeature
    {
        return null;
    }

    public function shouldRegister(): bool
    {
        if (! McpGrant::bound()) {
            return false;
        }

        if (! McpGrant::current()->has($this->requiredScope())) {
            return false;
        }

        return $this->requiredFeature()?->isAvailable() ?? true;
    }

    final public function handle(Request $request): Response|ResponseFactory
    {
        if (! $this->shouldRegister()) {
            return Response::error(__('Not found.'));
        }

        if ($this->requiredScope() !== McpScope::Read && ! $this->withinWriteLimit()) {
            return Response::error(__('Too many changes, wait a moment.'));
        }

        try {
            return $this->run($request);
        } catch (ModelNotFoundException) {
            return Response::error(__('Not found.'));
        } catch (AuthorizationException $exception) {
            return Response::error(__($exception->getMessage()));
        } catch (ValidationException $exception) {
            return Response::error(ValidationMessages::from($exception));
        } catch (HttpException $exception) {
            return Response::error($this->httpMessage($exception));
        } catch (IntegrationException $exception) {
            return Response::error($exception->userMessage());
        } catch (Throwable $exception) {
            Log::error('MCP tool failed.', [
                'tool' => $this->name(),
                'exception' => $exception::class,
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return Response::error(__('Something went wrong.'));
        }
    }

    protected function context(): McpContext
    {
        return app(McpContext::class);
    }

    /**
     * @return array<string, array<int, string>>
     */
    protected function paginationRules(int $maxLimit = 50): array
    {
        return [
            'limit' => ['nullable', 'integer', 'min:1', "max:{$maxLimit}"],
            'page' => ['nullable', 'integer', 'min:1', 'max:10000'],
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{0: int, 1: int}
     */
    protected function pagination(array $validated, int $maxLimit = 50): array
    {
        return [
            (int) ($validated['page'] ?? 1),
            min((int) ($validated['limit'] ?? self::DefaultLimit), $maxLimit),
        ];
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @param  callable(TModel): mixed  $present
     * @return array{items: array<int, mixed>, page: int, hasMore: bool}
     */
    protected function paginate(Builder $query, int $page, int $limit, callable $present): array
    {
        $rows = $query->skip(($page - 1) * $limit)->take($limit + 1)->get();

        return [
            'items' => $rows->take($limit)->map($present)->values()->all(),
            'page' => $page,
            'hasMore' => $rows->count() > $limit,
        ];
    }

    private function withinWriteLimit(): bool
    {
        $key = 'mcp-write:'.McpGrant::current()->tokenId;
        $maxAttempts = (int) config('skrum.mcp.write_rate_limit');

        return RateLimiter::increment($key, 60) <= $maxAttempts;
    }

    private function httpMessage(HttpException $exception): string
    {
        return match (true) {
            $exception->getStatusCode() === 404 => __('Not found.'),
            $exception->getStatusCode() === 423 => __('The board is closed for editing.'),
            $exception->getStatusCode() === 403 && $exception->getMessage() === '' => __('This action is unauthorized.'),
            $exception->getMessage() !== '' => $exception->getMessage(),
            default => __('Something went wrong.'),
        };
    }
}
