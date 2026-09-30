<?php

namespace App\Support\Integrations\Messages;

use Generator;
use Illuminate\Support\Str;

/**
 * Slack and Telegram limit message sizes, so lists shrink first (with
 * "+ n more"), then the summary, then the participant names.
 */
class RetroRecapContent implements ShareContent
{
    private const SummaryLimit = 2800;

    private const NamesLimit = 2800;

    public function __construct(public RetroRecap $recap) {}

    public function toSlack(): array
    {
        $recap = $this->recap;
        $heading = RecapText::heading($recap);

        $blocks = [
            ['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => SlackText::escape(Str::limit($heading, SlackText::HeaderLimit - 10, '…'))]],
            ['type' => 'context', 'elements' => [['type' => 'mrkdwn', 'text' => SlackText::escape(RecapText::context($recap))]]],
            $this->slackSection(implode("\n", array_filter([
                SlackText::escape(Str::limit(RecapText::participants($recap), self::NamesLimit, '…')),
                SlackText::escape(RecapText::cards($recap)),
                $this->escapeSlack(RecapText::roti($recap)),
            ]))),
        ];

        if ($recap->summary !== null) {
            $blocks[] = $this->slackSection('*'.SlackText::escape(__('Summary'))."*\n".SlackText::escape(Str::limit($recap->summary, self::SummaryLimit, '…')));
        }

        $lists = array_filter([
            $this->slackList(__('Action items'), array_map(RecapText::actionItem(...), $recap->actionItems), $recap->hiddenActionItems),
            $this->slackList(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions),
            $this->slackList(__('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0),
        ]);

        if ($lists !== []) {
            $blocks[] = ['type' => 'divider'];
            array_push($blocks, ...array_values($lists));
        }

        $blocks[] = ['type' => 'actions', 'elements' => [[
            'type' => 'button',
            'text' => ['type' => 'plain_text', 'text' => Str::limit(RecapText::openLabel(), SlackText::ButtonLimit - 1, '…')],
            'url' => $recap->url,
        ]]];

        return ['text' => SlackText::escape($heading), 'blocks' => $blocks];
    }

    public function toTelegram(): string
    {
        foreach ($this->telegramAttempts() as [$actionItems, $topCards, $summaryLimit, $withNames]) {
            $html = $this->telegramMessage($actionItems, $topCards, $summaryLimit, $withNames);

            if (mb_strlen($html) <= TelegramText::MessageLimit) {
                return $html;
            }
        }

        return $this->telegramMessage(0, 0, 0, false);
    }

    /**
     * @return array{type: string, text: array{type: string, text: string}}
     */
    private function slackSection(string $text): array
    {
        return ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => mb_substr($text, 0, SlackText::SectionLimit)]];
    }

    /**
     * @param  array<int, string>  $lines
     * @return array{type: string, text: array{type: string, text: string}}|null
     */
    private function slackList(string $heading, array $lines, int $hidden): ?array
    {
        if ($lines === []) {
            return null;
        }

        $shown = $lines;

        while (true) {
            $text = '*'.SlackText::escape($heading).'*';

            foreach ($shown as $line) {
                $text .= "\n• ".SlackText::escape($line);
            }

            $more = $hidden + count($lines) - count($shown);

            if ($more > 0) {
                $text .= "\n".SlackText::escape(RecapText::more($more));
            }

            if (mb_strlen($text) <= SlackText::SectionLimit || count($shown) <= 1) {
                return $this->slackSection($text);
            }

            array_pop($shown);
        }
    }

    private function escapeSlack(?string $text): ?string
    {
        return $text === null ? null : SlackText::escape($text);
    }

    /**
     * @return Generator<int, array{0: int, 1: int, 2: int, 3: bool}>
     */
    private function telegramAttempts(): Generator
    {
        $actionItems = count($this->recap->actionItems);
        $topCards = count($this->recap->topCards);

        while (true) {
            yield [$actionItems, $topCards, self::SummaryLimit, true];

            if ($actionItems === 0 && $topCards === 0) {
                break;
            }

            if ($topCards >= $actionItems) {
                $topCards--;
            } else {
                $actionItems--;
            }
        }

        yield [0, 0, 1000, true];
        yield [0, 0, 1000, false];
        yield [0, 0, 200, false];
    }

    private function telegramMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames): string
    {
        $recap = $this->recap;

        $parts = [
            '<b>'.TelegramText::escape(RecapText::heading($recap))."</b>\n".TelegramText::escape(RecapText::context($recap)),
            implode("\n", array_map(TelegramText::escape(...), array_filter([
                RecapText::participants($recap, $withNames),
                RecapText::cards($recap),
                RecapText::roti($recap),
            ]))),
        ];

        if ($recap->summary !== null && $summaryLimit > 0) {
            $parts[] = '<b>'.TelegramText::escape(__('Summary'))."</b>\n".TelegramText::escape(Str::limit($recap->summary, $summaryLimit, '…'));
        }

        $parts[] = $this->telegramList(
            __('Action items'),
            array_map(RecapText::actionItem(...), array_slice($recap->actionItems, 0, $actionItems)),
            $recap->hiddenActionItems + count($recap->actionItems) - $actionItems,
        );
        $parts[] = $this->telegramList(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions);
        $parts[] = $this->telegramList(
            __('Top card per column'),
            array_map(RecapText::topCard(...), array_slice($recap->topCards, 0, $topCards)),
            count($recap->topCards) - $topCards,
        );
        $parts[] = '<a href="'.TelegramText::escape($recap->url).'">'.TelegramText::escape(RecapText::openLabel()).'</a>';

        return implode("\n\n", array_filter($parts, fn (?string $part): bool => $part !== null && $part !== ''));
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function telegramList(string $heading, array $lines, int $more): ?string
    {
        if ($lines === [] && $more === 0) {
            return null;
        }

        $text = '<b>'.TelegramText::escape($heading).'</b>';

        foreach ($lines as $line) {
            $text .= "\n• ".TelegramText::escape($line);
        }

        if ($more > 0) {
            $text .= "\n".TelegramText::escape(RecapText::more($more));
        }

        return $text;
    }
}
