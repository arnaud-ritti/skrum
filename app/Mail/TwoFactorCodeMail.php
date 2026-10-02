<?php

namespace App\Mail;

use App\Support\Mail\MailBrand;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use SensitiveParameter;

class TwoFactorCodeMail extends BrandedMail implements ShouldBeEncrypted
{
    public function __construct(
        #[SensitiveParameter] public string $code,
        public int $expiresInMinutes,
        public ?string $device,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __(':code is your :app verification code', [
            'code' => $this->code,
            'app' => resolve(MailBrand::class)->name(),
        ]));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.two-factor-code',
            text: 'mail.text.two-factor-code',
            with: [
                ...$this->brandData(),
                'title' => __('Your verification code'),
                'preheader' => __('It expires in :minutes minutes.', ['minutes' => $this->expiresInMinutes]),
                'groups' => str_split($this->code, 3),
                'passwordUrl' => route('security.edit'),
            ],
        );
    }
}
