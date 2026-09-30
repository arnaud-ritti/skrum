<?php

namespace App\Support\Gifs;

use App\Models\Card;
use App\Models\GameGifAnswer;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;

class GifCatalog
{
    private const SearchTtlSeconds = 600;

    private const ItemTtlSeconds = 86400;

    private const ResultLimit = 24;

    public function provider(): ?GifProvider
    {
        $key = config('services.gifs.key');

        if (! is_string($key) || $key === '') {
            return null;
        }

        return match (config('services.gifs.provider')) {
            'giphy' => new GiphyProvider($key),
            'tenor' => new TenorProvider($key),
            default => null,
        };
    }

    public function providerName(): ?string
    {
        if ($this->provider() === null) {
            return null;
        }

        return (string) config('services.gifs.provider');
    }

    public function isAvailable(): bool
    {
        return $this->provider() !== null;
    }

    /**
     * @return array<int, Gif>
     */
    public function search(string $query): array
    {
        $provider = $this->provider();

        if ($provider === null) {
            return [];
        }

        $query = trim($query);
        $rating = (string) config('services.gifs.rating', 'pg');
        $cacheKey = "gifs:search:{$this->providerName()}:{$rating}:".md5(mb_strtolower($query));

        /** @var array<int, array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}> $items */
        $items = Cache::remember($cacheKey, self::SearchTtlSeconds, fn (): array => array_map(
            fn (Gif $gif) => $gif->toArray(),
            $query === ''
                ? $provider->trending($rating, self::ResultLimit)
                : $provider->search($query, $rating, self::ResultLimit),
        ));

        return array_map(function (array $item): Gif {
            $gif = Gif::fromArray($item);

            $this->remember($gif);

            return $gif;
        }, $items);
    }

    public function resolve(string $id): ?Gif
    {
        $cached = $this->cached($id);

        if ($cached !== null) {
            return $cached;
        }

        $gif = $this->provider()?->find($id);

        if ($gif !== null) {
            $this->remember($gif);
        }

        return $gif;
    }

    /**
     * Only GIFs someone searched for recently, or that a card or a game
     * answer uses, may be streamed, so the proxy cannot be used to fetch arbitrary provider content.
     */
    public function servable(string $id): ?Gif
    {
        $cached = $this->cached($id);

        if ($cached !== null) {
            return $cached;
        }

        $isUsed = Card::query()->where('gif_id', $id)->exists()
            || GameGifAnswer::query()->where('gif_id', $id)->exists();

        if (! $isUsed) {
            return null;
        }

        return $this->resolve($id);
    }

    /**
     * Provider errors can carry the request URL, which holds the API key,
     * so they end as a plain 502 and are never reported or logged.
     *
     * @template TResult
     *
     * @param  Closure(): TResult  $call
     * @return TResult
     */
    public function attempt(Closure $call, string $failureMessage): mixed
    {
        try {
            return $call();
        } catch (RequestException|ConnectionException) {
            abort(502, $failureMessage);
        }
    }

    private function cached(string $id): ?Gif
    {
        /** @var array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}|null $item */
        $item = Cache::get($this->itemKey($id));

        return $item === null ? null : Gif::fromArray($item);
    }

    private function remember(Gif $gif): void
    {
        Cache::put($this->itemKey($gif->id), $gif->toArray(), self::ItemTtlSeconds);
    }

    private function itemKey(string $id): string
    {
        return "gifs:item:{$this->providerName()}:{$id}";
    }
}
