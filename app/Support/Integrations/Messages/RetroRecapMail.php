<?php

namespace App\Support\Integrations\Messages;

use Illuminate\Notifications\Messages\MailMessage;

/**
 * The recap as a Markdown mail. User text has its Markdown characters escaped so that it can never
 * become a link or formatting; the mail template already escapes HTML, so
 * angle brackets are left alone to avoid double escaping.
 */
class RetroRecapMail
{
    /**
     * @param  array{score: float, participation: array{respondents: int, participants: int}}|null  $health
     */
    public function build(RetroRecap $recap, ?array $health): MailMessage
    {
        $mail = (new MailMessage)
            ->subject(RecapText::heading($recap))
            ->line($this->escape(RecapText::context($recap)))
            ->line($this->escape(RecapText::participants($recap)))
            ->line($this->escape(RecapText::cards($recap)));

        $roti = RecapText::roti($recap);

        if ($roti !== null) {
            $mail->line($this->escape($roti));
        }

        if ($health !== null) {
            $mail->line($this->escape(__('Health check: :score/10 (:respondents of :participants participants answered)', [
                'score' => number_format($health['score'], 1),
                'respondents' => $health['participation']['respondents'],
                'participants' => $health['participation']['participants'],
            ])));
        }

        if ($recap->summary !== null) {
            $mail->line('**'.$this->escape(__('Summary')).'**');

            foreach (preg_split('/\R{2,}/u', $recap->summary) ?: [] as $paragraph) {
                $mail->line($this->escape($paragraph));
            }
        }

        $this->list($mail, __('Action items'), array_map(RecapText::actionItem(...), $recap->actionItems), $recap->hiddenActionItems);
        $this->list($mail, __('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions);
        $this->list($mail, __('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0);

        return $mail->action(__('View the results'), $recap->url);
    }

    /**
     * @param  array<int, string>  $lines
     */
    private function list(MailMessage $mail, string $heading, array $lines, int $hidden): void
    {
        if ($lines === []) {
            return;
        }

        $mail->line('**'.$this->escape($heading).'**');

        foreach ($lines as $line) {
            $mail->line('• '.$this->escape($line));
        }

        if ($hidden > 0) {
            $mail->line($this->escape(RecapText::more($hidden)));
        }
    }

    private function escape(string $text): string
    {
        $singleLine = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return addcslashes($singleLine, '\\`*_{}[]()#+-.!|');
    }
}
