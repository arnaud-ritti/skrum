<?php

namespace App\Support\Integrations\Messages;

use Closure;
use Generator;
use Illuminate\Support\Str;

/**
 * Chat channels limit message sizes, so lists shrink first (with "+ n more"),
 * suggested actions next, then the summary, then the participant names.
 */
class RetroRecapContent implements ShareContent
{
    private const int SummaryLimit = 2800;

    private const int NamesLimit = 2800;

    /**
     * @param  array<string, mixed>  $webhookData
     */
    public function __construct(public RetroRecap $recap, public array $webhookData = []) {}

    public function toWebhook(): array
    {
        return $this->webhookData;
    }

    public function toSlack(): array
    {
        $recap = $this->recap;
        $heading = RecapText::heading($recap);

        $blocks = [
            ['type' => 'header', 'text' => ['type' => 'plain_text', 'text' => SlackText::cut(SlackText::escape($heading), SlackText::HeaderLimit)]],
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
        return $this->firstFitting(
            $this->telegramMessage(...),
            fn (string $html): bool => mb_strlen($html) <= TelegramText::MessageLimit,
        );
    }

    public function toMicrosoftTeams(): array
    {
        return $this->firstFitting($this->teamsMessage(...), MicrosoftTeamsText::fits(...));
    }

    public function toMattermost(): string
    {
        return $this->firstFitting(
            $this->mattermostMessage(...),
            fn (string $text): bool => mb_strlen($text) <= MattermostText::MessageLimit,
        );
    }

    /**
     * @template TMessage of string|array<string, mixed>
     *
     * @param  Closure(int, int, int, bool, int): TMessage  $build
     * @param  Closure(TMessage): bool  $fits
     * @return TMessage
     */
    private function firstFitting(Closure $build, Closure $fits): string|array
    {
        foreach ($this->attempts() as [$actionItems, $topCards, $summaryLimit, $withNames, $suggested]) {
            $message = $build($actionItems, $topCards, $summaryLimit, $withNames, $suggested);

            if ($fits($message)) {
                return $message;
            }
        }

        return $build(0, 0, 0, false, 0);
    }

    /**
     * @return array<string, mixed>
     */
    private function teamsMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames, int $suggested): array
    {
        $recap = $this->recap;

        $body = [
            MicrosoftTeamsText::block(RecapText::heading($recap), ['size' => 'Large', 'weight' => 'Bolder']),
            MicrosoftTeamsText::block(RecapText::context($recap), ['isSubtle' => true, 'spacing' => 'None']),
        ];

        foreach (array_filter([RecapText::participants($recap, $withNames), RecapText::cards($recap), RecapText::roti($recap)]) as $line) {
            $body[] = MicrosoftTeamsText::block($line, ['spacing' => 'None']);
        }

        if ($recap->summary !== null && $summaryLimit > 0) {
            $body[] = MicrosoftTeamsText::block(__('Summary'), ['weight' => 'Bolder']);
            $body[] = MicrosoftTeamsText::block(Str::limit($recap->summary, $summaryLimit, '…'), ['spacing' => 'None']);
        }

        array_push(
            $body,
            ...$this->teamsList(
                __('Action items'),
                array_map(RecapText::actionItem(...), array_slice($recap->actionItems, 0, $actionItems)),
                $recap->hiddenActionItems + count($recap->actionItems) - $actionItems,
            ),
            ...$this->teamsList(
                __('Suggested actions'),
                array_slice($recap->suggestedActions, 0, $suggested),
                $recap->hiddenSuggestedActions + count($recap->suggestedActions) - $suggested,
            ),
            ...$this->teamsList(
                __('Top card per column'),
                array_map(RecapText::topCard(...), array_slice($recap->topCards, 0, $topCards)),
                count($recap->topCards) - $topCards,
            ),
        );

        return MicrosoftTeamsText::message($body, MicrosoftTeamsText::openUrl(RecapText::openLabel(), $recap->url));
    }

    /**
     * @param  array<int, string>  $lines
     * @return array<int, array<string, mixed>>
     */
    private function teamsList(string $heading, array $lines, int $more): array
    {
        if ($lines === [] && $more === 0) {
            return [];
        }

        $blocks = [MicrosoftTeamsText::block($heading, ['weight' => 'Bolder'])];

        foreach ($lines as $line) {
            $blocks[] = MicrosoftTeamsText::block("• {$line}", ['spacing' => 'None']);
        }

        if ($more > 0) {
            $blocks[] = MicrosoftTeamsText::block(RecapText::more($more), ['spacing' => 'None', 'isSubtle' => true]);
        }

        return $blocks;
    }

    private function mattermostMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames, int $suggested): string
    {
        $recap = $this->recap;

        $parts = [
            '#### '.MattermostText::escape(RecapText::heading($recap))."\n".MattermostText::escape(RecapText::context($recap)),
            implode("\n", array_map(MattermostText::escape(...), array_filter([
                RecapText::participants($recap, $withNames),
                RecapText::cards($recap),
                RecapText::roti($recap),
            ]))),
        ];

        if ($recap->summary !== null && $summaryLimit > 0) {
            $parts[] = '**'.MattermostText::escape(__('Summary'))."**\n".MattermostText::escape(Str::limit($recap->summary, $summaryLimit, '…'));
        }

        $parts[] = $this->mattermostList(
            __('Action items'),
            array_map(RecapText::actionItem(...), array_slice($recap->actionItems, 0, $actionItems)),
            $recap->hiddenActionItems + count($recap->actionItems) - $actionItems,
        );
        $parts[] = $this->mattermostList(
            __('Suggested actions'),
            array_slice($recap->suggestedActions, 0, $suggested),
            $recap->hiddenSuggestedActions + count($recap->suggestedActions) - $suggested,
        );
        $parts[] = $this->mattermostList(
            __('Top card per column'),
            array_map(RecapText::topCard(...), array_slice($recap->topCards, 0, $topCards)),
            count($recap->topCards) - $topCards,
        );
        $parts[] = MattermostText::link(RecapText::openLabel(), $recap->url);

        return implode("\n\n", array_filter($parts, fn (?string $part): bool => $part !== null && $part !== ''));
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function mattermostList(string $heading, array $lines, int $more): ?string
    {
        if ($lines === [] && $more === 0) {
            return null;
        }

        $text = '**'.MattermostText::escape($heading).'**';

        foreach ($lines as $line) {
            $text .= "\n- ".MattermostText::escape($line);
        }

        if ($more > 0) {
            $text .= "\n".MattermostText::escape(RecapText::more($more));
        }

        return $text;
    }

    /**
     * @return array{type: string, text: array{type: string, text: string}}
     */
    private function slackSection(string $text): array
    {
        return ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => SlackText::cut($text, SlackText::SectionLimit)]];
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
     * @return Generator<int, array{0: int, 1: int, 2: int, 3: bool, 4: int}>
     */
    private function attempts(): Generator
    {
        $actionItems = count($this->recap->actionItems);
        $topCards = count($this->recap->topCards);
        $suggested = count($this->recap->suggestedActions);

        while (true) {
            yield [$actionItems, $topCards, self::SummaryLimit, true, $suggested];

            if ($actionItems === 0 && $topCards === 0) {
                break;
            }

            if ($topCards >= $actionItems) {
                $topCards--;
            } else {
                $actionItems--;
            }
        }

        while ($suggested > 0) {
            $suggested--;

            yield [0, 0, self::SummaryLimit, true, $suggested];
        }

        yield [0, 0, 1000, true, 0];
        yield [0, 0, 1000, false, 0];
        yield [0, 0, 200, false, 0];
    }

    private function telegramMessage(int $actionItems, int $topCards, int $summaryLimit, bool $withNames, int $suggested): string
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
        $parts[] = $this->telegramList(
            __('Suggested actions'),
            array_slice($recap->suggestedActions, 0, $suggested),
            $recap->hiddenSuggestedActions + count($recap->suggestedActions) - $suggested,
        );
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
