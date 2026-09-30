<?php

namespace App\Actions\Retros;

use App\Enums\CardSentiment;
use App\Support\Llm\LlmJson;

class ParseSummaryOutput
{
    private const MaxSummaryCharacters = 2000;

    private const MaxThemes = 8;

    private const MaxSuggestedActions = 8;

    public function handle(string $reply, SummaryInput $input): ?SummaryOutput
    {
        $decoded = LlmJson::decode($reply);
        $summary = is_string($decoded['summary'] ?? null) ? trim($decoded['summary']) : '';

        if ($decoded === null || $summary === '') {
            return null;
        }

        $themes = $this->themes($decoded['themes'] ?? null, $input);

        return new SummaryOutput(
            mb_substr($summary, 0, self::MaxSummaryCharacters),
            $themes,
            $this->suggestedActions($decoded['suggestedActions'] ?? null, array_column($themes, 'name')),
            $this->cardInsights($decoded['cardInsights'] ?? null, $input),
        );
    }

    /**
     * @return array<int, array{name: string, cardIds: array<int, string>}>
     */
    private function themes(mixed $items, SummaryInput $input): array
    {
        $themes = [];
        $assigned = [];

        foreach ($this->list($items) as $item) {
            if (! is_array($item)) {
                continue;
            }

            $name = is_string($item['name'] ?? null) ? trim($item['name']) : '';

            if ($name === '' || mb_strlen($name) > 80) {
                continue;
            }

            $cardIds = [];

            foreach ($this->list($item['cardIds'] ?? null) as $index) {
                $cardId = $this->isIndex($index) ? ($input->cardIds[(int) $index] ?? null) : null;

                if ($cardId === null || isset($assigned[$cardId])) {
                    continue;
                }

                $assigned[$cardId] = true;
                $cardIds[] = $cardId;
            }

            if ($cardIds === []) {
                continue;
            }

            $themes[] = ['name' => $name, 'cardIds' => $cardIds];

            if (count($themes) === self::MaxThemes) {
                break;
            }
        }

        return $themes;
    }

    /**
     * @param  array<int, string>  $themeNames
     * @return array<int, array{content: string, theme: ?string}>
     */
    private function suggestedActions(mixed $items, array $themeNames): array
    {
        $namesByKey = [];

        foreach ($themeNames as $themeName) {
            $namesByKey[mb_strtolower($themeName)] = $themeName;
        }

        $suggestions = [];

        foreach ($this->list($items) as $item) {
            if (! is_array($item)) {
                continue;
            }

            $content = is_string($item['content'] ?? null) ? trim($item['content']) : '';

            if ($content === '' || mb_strlen($content) > 500) {
                continue;
            }

            $theme = is_string($item['theme'] ?? null) ? ($namesByKey[mb_strtolower(trim($item['theme']))] ?? null) : null;
            $suggestions[] = ['content' => $content, 'theme' => $theme];

            if (count($suggestions) === self::MaxSuggestedActions) {
                break;
            }
        }

        return $suggestions;
    }

    /**
     * @return array<string, array{sentiment: ?CardSentiment, category: ?string}>
     */
    private function cardInsights(mixed $items, SummaryInput $input): array
    {
        $insights = [];

        foreach ($this->list($items) as $item) {
            if (! is_array($item)) {
                continue;
            }

            $index = $item['cardId'] ?? null;
            $cardId = $this->isIndex($index) && (int) $index <= BuildSummaryInput::MaxInsightCards
                ? ($input->cardIds[(int) $index] ?? null)
                : null;

            if ($cardId === null) {
                continue;
            }

            $sentiment = is_string($item['sentiment'] ?? null) ? CardSentiment::tryFrom(strtolower(trim($item['sentiment']))) : null;
            $category = is_string($item['category'] ?? null) ? trim($item['category']) : '';
            $category = $category === '' || mb_strlen($category) > 40 ? null : $category;

            if ($sentiment === null && $category === null) {
                continue;
            }

            $insights[$cardId] = ['sentiment' => $sentiment, 'category' => $category];
        }

        return $insights;
    }

    /**
     * @return array<int, mixed>
     */
    private function list(mixed $items): array
    {
        return is_array($items) && array_is_list($items) ? $items : [];
    }

    private function isIndex(mixed $value): bool
    {
        return is_int($value) || (is_string($value) && ctype_digit($value));
    }
}
