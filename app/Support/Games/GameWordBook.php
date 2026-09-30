<?php

namespace App\Support\Games;

/**
 * Word and GIF-question lists per locale, read from resources/games. The
 * files are immutable, so one copy per process is safe under Octane.
 */
class GameWordBook
{
    /** @var array<string, array<int, mixed>> */
    private static array $files = [];

    /**
     * @param  array<string, array<int, array{word: string, drawable: bool}>>|null  $words
     * @param  array<string, array<int, string>>|null  $questions
     */
    public function __construct(
        private ?array $words = null,
        private ?array $questions = null,
    ) {}

    /**
     * @return array<int, array{word: string, drawable: bool}>
     */
    public function entries(string $locale): array
    {
        if ($this->words !== null) {
            return $this->words[$locale] ?? $this->words['en'] ?? [];
        }

        /** @var array<int, array{word: string, drawable: bool}> */
        return self::file('words', $locale);
    }

    /**
     * @return array<int, string>
     */
    public function words(string $locale, bool $drawableOnly): array
    {
        $entries = array_filter(
            $this->entries($locale),
            fn (array $entry): bool => ! $drawableOnly || $entry['drawable'],
        );

        return array_values(array_map(fn (array $entry): string => $entry['word'], $entries));
    }

    /**
     * @return array<int, string>
     */
    public function questions(string $locale): array
    {
        if ($this->questions !== null) {
            return $this->questions[$locale] ?? $this->questions['en'] ?? [];
        }

        /** @var array<int, string> */
        return self::file('gif-questions', $locale);
    }

    /**
     * @return array<int, mixed>
     */
    private static function file(string $kind, string $locale): array
    {
        $locale = self::supported($locale);

        return self::$files["{$kind}/{$locale}"] ??= require resource_path("games/{$kind}/{$locale}.php");
    }

    public static function supported(string $locale): string
    {
        /** @var array<int, string> $locales */
        $locales = config('skrum.locales');

        return in_array($locale, $locales, true) ? $locale : 'en';
    }
}
