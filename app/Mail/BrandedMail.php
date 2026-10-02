<?php

namespace App\Mail;

use App\Models\User;
use App\Support\Mail\MailBrand;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Queue\SerializesModels;

abstract class BrandedMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function forNotifiable(AnonymousNotifiable|User $notifiable): static
    {
        $address = $notifiable->routeNotificationFor('mail');

        if (blank($address)) {
            return $this;
        }

        return $this->to($address);
    }

    /**
     * @return array{brand: MailBrand, colors: array{light: array<string, string>, dark: array<string, string>}}
     */
    protected function brandData(): array
    {
        $brand = resolve(MailBrand::class);

        return ['brand' => $brand, 'colors' => $brand->colors()];
    }
}
