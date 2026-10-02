<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;

class RetroResultsMail extends BrandedMail
{
    /**
     * @param  array<int, string>  $facts
     * @param  array<int, string>  $summary
     * @param  array<int, array{heading: string, lines: array<int, string>, more: ?string}>  $sections
     */
    public function __construct(
        public array $facts,
        public array $summary,
        public array $sections,
        public string $url,
        public string $settingsUrl,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.retro-results',
            text: 'mail.text.retro-results',
            with: [...$this->brandData(), 'title' => $this->subject, 'preheader' => $this->facts[0] ?? $this->subject],
        );
    }
}
