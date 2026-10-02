<?php

namespace App\Support\Integrations\Messages;

use App\Mail\RetroResultsMail;
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
        $facts = array_filter([
            RecapText::context($recap),
            RecapText::participants($recap),
            RecapText::cards($recap),
            RecapText::roti($recap),
            $health === null ? null : __('Health check: :score/10 (:respondents of :participants participants answered)', [
                'score' => number_format($health['score'], 1),
                'respondents' => $health['participation']['respondents'],
                'participants' => $health['participation']['participants'],
            ]),
        ]);

        $sections = array_filter([
            $this->section(__('Action items'), array_map(RecapText::actionItem(...), $recap->actionItems), $recap->hiddenActionItems),
            $this->section(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions),
            $this->section(__('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0),
        ]);

        return (new RetroResultsMail(
            array_values(array_map(Str::squish(...), $facts)),
            $recap->summary === null ? [] : array_values(array_map(Str::squish(...), preg_split('/\R{2,}/u', $recap->summary) ?: [])),
            array_values($sections),
            $recap->url,
            route('notificationPreferences.edit'),
        ))->subject(Str::squish(RecapText::heading($recap)));
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
