<?php

namespace App\Support\Llm;

class LlmJson
{
    /**
     * Models sometimes wrap JSON in a Markdown fence or a sentence; only the
     * JSON value itself is kept, cutting trailing prose at the last closing
     * bracket that still parses. Only a fence around the whole reply is
     * unwrapped, so a fence inside a string value stays in it.
     *
     * @return array<array-key, mixed>|null
     */
    public static function decode(string $text): ?array
    {
        $trimmed = trim($text);
        $whole = json_decode($trimmed, true);

        if (is_array($whole)) {
            return $whole;
        }

        if (preg_match('/^```(?:json)?\s*(.*)```$/s', $trimmed, $matches) === 1) {
            $trimmed = trim($matches[1]);
        }

        $start = strcspn($trimmed, '[{');

        if ($start === strlen($trimmed)) {
            return null;
        }

        $candidate = substr($trimmed, $start);

        for ($end = strlen($candidate); $end > 0; $end = self::previousClosingBracket($candidate, $end)) {
            $decoded = json_decode(substr($candidate, 0, $end), true);

            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    private static function previousClosingBracket(string $text, int $before): int
    {
        $position = strrpos(substr($text, 0, $before - 1), '}');
        $arrayPosition = strrpos(substr($text, 0, $before - 1), ']');

        $last = max($position === false ? -1 : $position, $arrayPosition === false ? -1 : $arrayPosition);

        return $last + 1;
    }
}
