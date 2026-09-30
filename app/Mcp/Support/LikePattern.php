<?php

namespace App\Mcp\Support;

class LikePattern
{
    public static function contains(string $term): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $term).'%';
    }

    public static function snippet(string $text, string $term, int $length = 160): string
    {
        $text = trim((string) preg_replace('/\s+/u', ' ', $text));

        if (mb_strlen($text) <= $length) {
            return $text;
        }

        $position = mb_stripos($text, $term);
        $position = $position === false ? 0 : $position;
        $room = $length - 2;
        $start = max(0, min($position - intdiv($room - mb_strlen($term), 2), mb_strlen($text) - $room));
        $snippet = mb_substr($text, $start, $room);

        return ($start > 0 ? '…' : '').$snippet.($start + $room < mb_strlen($text) ? '…' : '');
    }
}
