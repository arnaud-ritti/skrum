<?php

namespace App\Support;

use Illuminate\Translation\Translator;
use Stringable;

use function Illuminate\Support\enum_value;

/**
 * French elision of a placeholder: "Tour de :name" with Inès reads "Tour d'Inès", "en tant que :name" reads
 * "en tant qu'Inès". Only a vowel elides: an h is left alone, because the app cannot tell a mute h (Hugo)
 * from an aspirated one (hibou), and a URL starts with an h too.
 *
 * resources/js/lib/elision.ts applies the same rule on the front end.
 */
class ElidingTranslator extends Translator
{
    private const string ElidableWords = 'de|que|le|la|je|ne|se|jusque|lorsque|puisque';

    private const string ElidingStart = '/^[aeiouàâäæéèêëîïôöœùûü]/iu';

    private ?string $replacingLocale = null;

    /**
     * @param  array<string, mixed>  $replace
     */
    public static function elide(string $line, array $replace): string
    {
        foreach ($replace as $key => $value) {
            $value = enum_value($value);

            if (! is_string($value) && ! $value instanceof Stringable) {
                continue;
            }

            if (preg_match(self::ElidingStart, (string) $value) !== 1) {
                continue;
            }

            $placeholder = preg_quote((string) $key, '/');

            $line = preg_replace_callback(
                '/(?<!\p{L})('.self::ElidableWords.") (?=:{$placeholder}(?![\\p{L}\\d_]))/iu",
                fn (array $match): string => mb_substr($match[1], 0, -1)."'",
                $line,
            ) ?? $line;
        }

        return $line;
    }

    /**
     * @param  string  $key
     * @param  array<string, mixed>  $replace
     * @param  string|null  $locale
     * @param  bool  $fallback
     * @return string|array<array-key, mixed>
     */
    public function get($key, array $replace = [], $locale = null, $fallback = true)
    {
        return $this->replacingIn($locale ?: $this->locale, fn () => parent::get($key, $replace, $locale, $fallback));
    }

    /**
     * @param  string  $key
     * @param  \Countable|int|float|array<array-key, mixed>  $number
     * @param  array<string, mixed>  $replace
     * @param  string|null  $locale
     */
    public function choice($key, $number, array $replace = [], $locale = null): string
    {
        return $this->replacingIn($this->localeForChoice($key, $locale), fn () => parent::choice($key, $number, $replace, $locale));
    }

    /**
     * @param  string  $line
     * @param  array<string, mixed>  $replace
     */
    protected function makeReplacements($line, array $replace): string
    {
        if (str_starts_with($this->replacingLocale ?? $this->locale, 'fr')) {
            $line = self::elide($line, $replace);
        }

        return parent::makeReplacements($line, $replace);
    }

    /**
     * @template TResult
     *
     * @param  callable(): TResult  $translate
     * @return TResult
     */
    private function replacingIn(string $locale, callable $translate): mixed
    {
        $previousLocale = $this->replacingLocale;
        $this->replacingLocale = $locale;

        try {
            return $translate();
        } finally {
            $this->replacingLocale = $previousLocale;
        }
    }
}
