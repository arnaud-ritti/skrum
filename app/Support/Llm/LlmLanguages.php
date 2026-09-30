<?php

namespace App\Support\Llm;

class LlmLanguages
{
    private const Names = ['en' => 'English', 'fr' => 'French', 'es' => 'Spanish', 'de' => 'German'];

    public static function for(string $locale): string
    {
        return self::Names[$locale] ?? self::Names['en'];
    }
}
