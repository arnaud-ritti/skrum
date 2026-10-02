<?php

namespace App\Support\Gifs;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use SensitiveParameter;

class GiphyProvider implements GifProvider
{
    public function __construct(#[SensitiveParameter] private string $key) {}

    public function search(string $query, string $rating, int $limit): array
    {
        return $this->list('search', ['q' => $query, 'rating' => $rating, 'limit' => $limit]);
    }

    public function trending(string $rating, int $limit): array
    {
        return $this->list('trending', ['rating' => $rating, 'limit' => $limit]);
    }

    public function find(string $id): ?Gif
    {
        $response = $this->client()->get(rawurlencode($id), ['api_key' => $this->key]);

        if ($response->notFound()) {
            return null;
        }

        $item = $response->throw()->json('data');

        return is_array($item) ? $this->toGif($item) : null;
    }

    /**
     * @param  array<string, string|int>  $query
     * @return array<int, Gif>
     */
    private function list(string $endpoint, array $query): array
    {
        $items = $this->client()->get($endpoint, [...$query, 'api_key' => $this->key])->throw()->json('data', []);

        return collect(is_array($items) ? $items : [])
            ->map(fn (mixed $item): ?Gif => is_array($item) ? $this->toGif($item) : null)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function toGif(array $item): ?Gif
    {
        $preview = data_get($item, 'images.fixed_width.webp', data_get($item, 'images.fixed_width.url'));
        $full = data_get($item, 'images.original.webp', data_get($item, 'images.original.url'));

        if (! is_string($preview) || ! is_string($full) || ! isset($item['id'])) {
            return null;
        }

        return new Gif(
            (string) $item['id'],
            $preview,
            $full,
            (int) data_get($item, 'images.fixed_width.width', 200),
            (int) data_get($item, 'images.fixed_width.height', 200),
        );
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl('https://api.giphy.com/v1/gifs/')->timeout(5)->acceptJson();
    }
}
