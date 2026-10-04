<?php

namespace App\Support\Integrations\Messages;

use App\Mail\RetroResultsMail;
use Illuminate\Support\Number;
use Illuminate\Support\Str;

/**
 * The recap as the data of a branded mail. Every string is plain text: the
 * Blade views escape it, so user text can never become markup.
 */
class RetroRecapMail
{
    /**
     * @param  array{score: float, participation: array{respondents: int, participants: int}}|null  $health
     */
    public function build(RetroRecap $recap, ?array $health): RetroResultsMail
    {
        $title = Str::squish($recap->title);
        $facilitator = $recap->facilitatorName === null ? null : Str::squish($recap->facilitatorName);
        $actionsCount = count($recap->actionItems) + $recap->hiddenActionItems;
        $roti = $recap->rotiCounts === null || $recap->rotiAverage === null
            ? null
            : (string) Number::format($recap->rotiAverage, 1, locale: app()->getLocale());

        $sections = array_filter([
            $this->section(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions),
            $this->section(__('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0),
            $this->section(__('Discussion notes'), array_map(RecapText::topicNote(...), $recap->topicNotes), 0),
        ]);

        return new RetroResultsMail(
            heading: __(':title is done', ['title' => $title]),
            lead: $this->lead($recap, $facilitator),
            preheader: $this->preheader($recap, $facilitator),
            stats: $this->stats($recap, $actionsCount, $roti),
            actions: array_map($this->action(...), $recap->actionItems),
            moreActions: $recap->hiddenActionItems > 0 ? RecapText::more($recap->hiddenActionItems) : null,
            roti: $roti === null ? null : $this->roti($recap),
            participantsLine: $recap->participantNames === null ? null : Str::squish(RecapText::participants($recap)),
            summary: $recap->summary === null ? [] : array_map(Str::squish(...), preg_split('/\R{2,}/u', $recap->summary) ?: []),
            sections: array_values($sections),
            healthLine: $this->healthLine($health),
            url: $recap->url,
            settingsUrl: route('notificationPreferences.edit'),
        )->subject($this->subject($recap, $title, $actionsCount, $roti));
    }

    /**
     * @param  array{score: float, participation: array{respondents: int, participants: int}}|null  $health
     */
    private function healthLine(?array $health): ?string
    {
        if ($health === null) {
            return null;
        }

        return __('Health check: :score/5 (:respondents of :participants participants answered)', [
            'score' => number_format($health['score'], 1),
            'respondents' => $health['participation']['respondents'],
            'participants' => $health['participation']['participants'],
        ]);
    }

    private function subject(RetroRecap $recap, string $title, int $actionsCount, ?string $roti): string
    {
        $replace = [
            'title' => $title,
            'team' => Str::squish($recap->teamName),
            'actions' => trans_choice('{0} no action|{1} :count action|[2,*] :count actions', $actionsCount),
        ];

        if ($roti === null) {
            return __(':title · :team — :actions', $replace);
        }

        return __(':title · :team — :actions, ROTI :roti', [...$replace, 'roti' => $roti]);
    }

    private function lead(RetroRecap $recap, ?string $facilitator): string
    {
        $date = $recap->completedDay ?? $recap->completedOn;

        if ($facilitator === null) {
            return __('Completed on :date. Here is what the team decided.', ['date' => $date]);
        }

        return __('Facilitated by :name on :date. Here is what the team decided.', ['name' => $facilitator, 'date' => $date]);
    }

    private function preheader(RetroRecap $recap, ?string $facilitator): string
    {
        $counts = ['participants' => $recap->participantCount, 'cards' => $recap->cardCount];

        if ($facilitator === null) {
            return __(':participants participants, :cards cards.', $counts);
        }

        return __(':participants participants, :cards cards, facilitated by :name.', [...$counts, 'name' => $facilitator]);
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    private function stats(RetroRecap $recap, int $actionsCount, ?string $roti): array
    {
        $stats = [
            ['value' => (string) $recap->participantCount, 'label' => __('Participants')],
            ['value' => (string) $recap->cardCount, 'label' => __('Cards')],
            ['value' => (string) $actionsCount, 'label' => __('Actions')],
        ];

        if ($roti === null) {
            return $stats;
        }

        return [...$stats, ['value' => $roti, 'label' => __('ROTI /5')]];
    }

    /**
     * @param  array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool, assigneeInitials?: ?string, assigneePresence?: ?int, dueDay?: ?string}  $item
     * @return array{content: string, meta: string, initials: ?string, presence: ?int}
     */
    private function action(array $item): array
    {
        return [
            'content' => Str::squish(($item['isCompleted'] ? '✓ ' : '').$item['content']),
            'meta' => Str::squish($this->actionMeta($item['assignee'], $item['dueDay'] ?? $item['dueOn'])),
            'initials' => $item['assigneeInitials'] ?? null,
            'presence' => $item['assigneePresence'] ?? null,
        ];
    }

    private function actionMeta(?string $assignee, ?string $due): string
    {
        if ($assignee === null && $due === null) {
            return __('Unassigned');
        }

        if ($assignee === null) {
            return __('Unassigned · due :date', ['date' => $due]);
        }

        if ($due === null) {
            return $assignee;
        }

        return __(':name · due :date', ['name' => $assignee, 'date' => $due]);
    }

    /**
     * Widths are percentages of the widest bar: no calc, no CSS variable.
     *
     * @return array{label: string, rows: array<int, array{score: int, count: int, width: int}>}|null
     */
    private function roti(RetroRecap $recap): ?array
    {
        $counts = $recap->rotiCounts;

        if ($counts === null) {
            return null;
        }

        $widest = max(1, ...array_values($counts));

        return [
            'label' => __('Return on time invested · :count votes', ['count' => $recap->rotiRespondents]),
            'rows' => array_map(fn (int $score): array => [
                'score' => $score,
                'count' => $counts[$score],
                'width' => (int) round($counts[$score] * 100 / $widest),
            ], range(1, 5)),
        ];
    }

    /**
     * @param  array<int, string>  $lines
     * @return array{heading: string, lines: array<int, string>, more: ?string}|null
     */
    private function section(string $heading, array $lines, int $hidden): ?array
    {
        if ($lines === []) {
            return null;
        }

        return [
            'heading' => $heading,
            'lines' => array_values(array_map(Str::squish(...), $lines)),
            'more' => $hidden > 0 ? RecapText::more($hidden) : null,
        ];
    }
}
