<?php

namespace App\Support\Gifs;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class TenorProvider implements GifProvider
{
    private const ContentFilters = ['g' => 'high', 'pg' => 'medium', 'pg-13' => 'low', 'r' => 'off'];

    public function __construct(private string $key) {}

    public function search(string $query, string $rating, int $limit): array
    {
        return $this->list('search', ['q' => $query, 'limit' => $limit, 'contentfilter' => $this->contentFilter($rating)]);
    }

    public function trending(string $rating, int $limit): array
    {
        return $this->list('featured', ['limit' => $limit, 'contentfilter' => $this->contentFilter($rating)]);
    }

    public function find(string $id): ?Gif
    {
        return $this->list('posts', ['ids' => $id])[0] ?? null;
    }

    /**
     * @param  array<string, string|int>  $query
     * @return array<int, Gif>
     */
    private function list(string $endpoint, array $query): array
    {
        $items = $this->client()
            ->get($endpoint, [...$query, 'key' => $this->key, 'media_filter' => 'gif,tinygif'])
            ->throw()
            ->json('results', []);

        return collect(is_array($items) ? $items : [])
            ->map(fn (mixed $item) => is_array($item) ? $this->toGif($item) : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function toGif(array $item): ?Gif
    {
        $preview = data_get($item, 'media_formats.tinygif.url');
        $full = data_get($item, 'media_formats.gif.url');

        if (! is_string($preview) || ! is_string($full) || ! isset($item['id'])) {
            return null;
        }

        return new Gif(
            (string) $item['id'],
            $preview,
            $full,
            (int) data_get($item, 'media_formats.tinygif.dims.0', 200),
            (int) data_get($item, 'media_formats.tinygif.dims.1', 200),
        );
    }

    private function contentFilter(string $rating): string
    {
        return self::ContentFilters[$rating] ?? 'medium';
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl('https://tenor.googleapis.com/v2/')->timeout(5)->acceptJson();
    }
}
