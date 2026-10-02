<?php

namespace App\Mail;

use App\Support\Mail\MailBrand;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use SensitiveParameter;

class MagicLinkMail extends BrandedMail implements ShouldBeEncrypted
{
    public function __construct(
        #[SensitiveParameter] public string $url,
        public string $email,
        public int $expiresInMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine());
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.magic-link',
            text: 'mail.text.magic-link',
            with: [
                ...$this->brandData(),
                'title' => $this->subjectLine(),
                'preheader' => __('Valid for :minutes minutes, works once.', ['minutes' => $this->expiresInMinutes]),
            ],
        );
    }

    private function subjectLine(): string
    {
        return __('Your sign-in link for :app', ['app' => resolve(MailBrand::class)->name()]);
    }
}
