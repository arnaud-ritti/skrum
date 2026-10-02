<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Headers;

class ActionItemReminderMail extends BrandedMail
{
    /**
     * @param  array<int, array{content: string, url: string, team: string, source: string, due: string}>  $overdue
     * @param  array<int, array{content: string, url: string, team: string, source: string, due: string}>  $dueSoon
     */
    public function __construct(
        public array $overdue,
        public array $dueSoon,
        public int $hidden,
        public ?string $listUrl,
        public string $unsubscribeUrl,
        public string $settingsUrl,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.action-item-reminder',
            text: 'mail.text.action-item-reminder',
            with: [...$this->brandData(), 'title' => $this->subject, 'preheader' => $this->subject],
        );
    }

    public function headers(): Headers
    {
        return new Headers(text: [
            'List-Unsubscribe' => "<{$this->unsubscribeUrl}>",
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }
}
