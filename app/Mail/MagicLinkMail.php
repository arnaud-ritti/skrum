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
        return new Envelope(subject: __('Your sign-in link for :app', ['app' => resolve(MailBrand::class)->name()]));
    }

    public function content(): Content
    {
        $title = __('Sign in to :app', ['app' => resolve(MailBrand::class)->name()]);

        return new Content(
            view: 'mail.magic-link',
            text: 'mail.text.magic-link',
            with: [...$this->brandData(), 'title' => $title, 'preheader' => __('The link works once and expires in :minutes minutes.', ['minutes' => $this->expiresInMinutes])],
        );
    }
}
