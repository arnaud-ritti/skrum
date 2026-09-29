<?php

namespace App\Support\Gifs;

interface GifProvider
{
    /** @return array<int, Gif> */
    public function search(string $query, string $rating, int $limit): array;

    /** @return array<int, Gif> */
    public function trending(string $rating, int $limit): array;

    public function find(string $id): ?Gif;
}
