<?php

namespace App\Mail;

use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use SensitiveParameter;

class EmailVerificationMail extends BrandedMail implements ShouldBeEncrypted
{
    public function __construct(#[SensitiveParameter] public string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __('Verify your email address'));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.auth-action',
            text: 'mail.text.auth-action',
            with: [
                ...$this->brandData(),
                'title' => __('Verify your email address'),
                'preheader' => __('Please click the button below to verify your email address.'),
                'actionLabel' => __('Verify Email Address'),
                'bodyMessage' => __('Please click the button below to verify your email address.'),
                'ignoreMessage' => __('If you did not create an account, no further action is required.'),
                'expiryMessage' => __('The link expires in :minutes minutes.', ['minutes' => (int) config('auth.verification.expire', 60)]),
            ],
        );
    }
}
