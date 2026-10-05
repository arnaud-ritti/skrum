<?php

namespace App\Support\Integrations\Messages;

use Illuminate\Support\Number;

/**
 * The recap's lines as plain, unescaped text in the current locale; each
 * formatter escapes them for its own channel.
 */
class RecapText
{
    public static function heading(RetroRecap $recap): string
    {
        return __('Results of the retrospective ":title"', ['title' => $recap->title]);
    }

    public static function context(RetroRecap $recap): string
    {
        return __(':team · completed on :date', ['team' => $recap->teamName, 'date' => $recap->completedOn]);
    }

    public static function participants(RetroRecap $recap, bool $withNames = true): string
    {
        if ($recap->participantNames === null || ! $withNames) {
            return __('Participants: :count', ['count' => $recap->participantCount]);
        }

        return __('Participants (:count): :names', [
            'count' => $recap->participantCount,
            'names' => implode(', ', $recap->participantNames),
        ]);
    }

    public static function cards(RetroRecap $recap): string
    {
        return __('Cards: :count', ['count' => $recap->cardCount]);
    }

    public static function roti(RetroRecap $recap): ?string
    {
        if ($recap->rotiAverage === null) {
            return null;
        }

        return trans_choice('ROTI: :average/5 (:count answer)|ROTI: :average/5 (:count answers)', $recap->rotiRespondents, [
            'average' => Number::format($recap->rotiAverage, 1, locale: app()->getLocale()),
            'count' => $recap->rotiRespondents,
        ]);
    }

    /**
     * @param  array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}  $item
     */
    public static function actionItem(array $item): string
    {
        $line = ($item['isCompleted'] ? '✓ ' : '').$item['content'];

        if ($item['assignee'] !== null) {
            $line .= " — {$item['assignee']}";
        }

        if ($item['dueOn'] !== null) {
            $line .= ' · '.__('Due :date', ['date' => $item['dueOn']]);
        }

        return $line;
    }

    /**
     * @param  array{column: string, content: string, votes: int, groupedCount: int}  $card
     */
    public static function topCard(array $card): string
    {
        $counts = __('votes: :count', ['count' => $card['votes']]);

        if ($card['groupedCount'] > 0) {
            $counts .= ', '.__('grouped cards: :count', ['count' => $card['groupedCount']]);
        }

        return "{$card['column']} — {$card['content']} ({$counts})";
    }

    /**
     * @param  array{title: string, note: string}  $note
     */
    public static function topicNote(array $note): string
    {
        return "{$note['title']} — {$note['note']}";
    }

    public static function more(int $count): string
    {
        return __('+ :count more', ['count' => $count]);
    }

    public static function openLabel(): string
    {
        return __('Open the results');
    }
}
