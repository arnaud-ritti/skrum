<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Headers;

class RetroResultsMail extends BrandedMail
{
    public ?string $unsubscribeUrl = null;

    /**
     * @param  array<int, array{value: string, label: string}>  $stats
     * @param  array<int, array{content: string, meta: string, initials: ?string, presence: ?int}>  $actions
     * @param  array{label: string, rows: array<int, array{score: int, count: int, width: int}>}|null  $roti
     * @param  array<int, string>  $summary
     * @param  array<int, array{heading: string, lines: array<int, string>, more: ?string}>  $sections
     */
    public function __construct(
        public string $heading,
        public string $lead,
        public string $preheader,
        public array $stats,
        public array $actions,
        public ?string $moreActions,
        public ?array $roti,
        public ?string $participantsLine,
        public array $summary,
        public array $sections,
        public ?string $healthLine,
        public string $url,
        public string $settingsUrl,
    ) {}

    public function unsubscribeVia(string $url): static
    {
        $this->unsubscribeUrl = $url;

        return $this;
    }

    public function headers(): Headers
    {
        if ($this->unsubscribeUrl === null) {
            return new Headers;
        }

        return new Headers(text: [
            'List-Unsubscribe' => "<{$this->unsubscribeUrl}>",
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.retro-results',
            text: 'mail.text.retro-results',
            with: [
                ...$this->brandData(),
                'title' => $this->subject,
                'unsubscribeUrl' => $this->unsubscribeUrl,
            ],
        );
    }
}
