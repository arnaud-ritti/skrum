<?php

namespace App\Mail;

use App\Enums\EmailCodePurpose;
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
        public string $requestedAt,
        public EmailCodePurpose $purpose = EmailCodePurpose::Login,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine());
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.two-factor-code',
            text: 'mail.text.two-factor-code',
            with: [
                ...$this->brandData(),
                'title' => $this->subjectLine(),
                'preheader' => __('It expires in :minutes minutes.', ['minutes' => $this->expiresInMinutes]),
                'groups' => str_split($this->code, 3),
                'passwordUrl' => route('security.edit'),
                'confirmsAnAction' => $this->purpose === EmailCodePurpose::Confirm,
            ],
        );
    }

    private function subjectLine(): string
    {
        return __('Your :app verification code: :code', [
            'app' => resolve(MailBrand::class)->name(),
            'code' => implode(' ', str_split($this->code, 3)),
        ]);
    }
}
