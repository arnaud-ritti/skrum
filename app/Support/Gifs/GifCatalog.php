<?php

namespace App\Support\Gifs;

use App\Models\Card;
use App\Models\GameGifAnswer;
use App\Support\InstanceSettings;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;

class GifCatalog
{
    private const int SearchTtlSeconds = 600;

    private const int ItemTtlSeconds = 86400;

    private const int ResultLimit = 24;

    public function __construct(private InstanceSettings $settings) {}

    public function provider(): ?GifProvider
    {
        if (! $this->settings->gifEnabled()) {
            return null;
        }

        $key = $this->settings->gifKey();

        if ($key === null) {
            return null;
        }

        return match ($this->settings->gifProvider()) {
            'giphy' => new GiphyProvider($key),
            'tenor' => new TenorProvider($key),
            default => null,
        };
    }

    public function providerName(): ?string
    {
        if (! $this->settings->gifEnabled()) {
            return null;
        }

        return $this->settings->gifProvider();
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
        $rating = $this->settings->gifRating();
        $cacheKey = "gifs:search:{$this->providerName()}:{$rating}:".hash('xxh128', mb_strtolower($query));

        /** @var array<int, array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}> $items */
        $items = Cache::remember($cacheKey, self::SearchTtlSeconds, function () use ($provider, $query, $rating): array {
            $gifs = $query === ''
                ? $provider->trending($rating, self::ResultLimit)
                : $provider->search($query, $rating, self::ResultLimit);

            foreach ($gifs as $gif) {
                $this->remember($gif);
            }

            return array_map(fn (Gif $gif): array => $gif->toArray(), $gifs);
        });

        return array_map(Gif::fromArray(...), $items);
    }

    /**
     * The search as the GIF pickers show it; a provider failure answers 502.
     *
     * @return array<int, array{id: string, previewUrl: string, width: int, height: int}>
     */
    public function pickerResults(string $query): array
    {
        return array_map(fn (Gif $gif): array => [
            'id' => $gif->id,
            'previewUrl' => route('gifs.show', ['gif' => $gif->id, 'size' => 'preview'], false),
            'width' => $gif->width,
            'height' => $gif->height,
        ], $this->attempt(fn (): array => $this->search($query), __('GIF search is unavailable.')));
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

    /**
     * Kept longer than a search result, so every GIF of a cached search stays servable.
     */
    private function remember(Gif $gif): void
    {
        Cache::put($this->itemKey($gif->id), $gif->toArray(), self::ItemTtlSeconds);
    }

    private function itemKey(string $id): string
    {
        return "gifs:item:{$this->providerName()}:{$id}";
    }
}
