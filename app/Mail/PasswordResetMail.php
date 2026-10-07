<?php

namespace App\Mail;

use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use SensitiveParameter;

class PasswordResetMail extends BrandedMail implements ShouldBeEncrypted
{
    public function __construct(#[SensitiveParameter] public string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __('Reset your password'));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.auth-action',
            text: 'mail.text.auth-action',
            with: [
                ...$this->brandData(),
                'title' => __('Reset your password'),
                'preheader' => __('You are receiving this email because we received a password reset request for your account.'),
                'actionLabel' => __('Reset Password'),
                'bodyMessage' => __('You are receiving this email because we received a password reset request for your account.'),
                'ignoreMessage' => __('If you did not request a password reset, no further action is required.'),
                'expiryMessage' => __('The link expires in :minutes minutes.', ['minutes' => (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60)]),
            ],
        );
    }
}
