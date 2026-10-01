<?php

namespace App\Rules;

use App\Support\Integrations\Exceptions\UnsafeWebhookUrl;
use App\Support\Integrations\Webhook\SafeWebhookUrl;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class OutgoingWebhookUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('This URL points to a private or invalid address.'));

            return;
        }

        try {
            resolve(SafeWebhookUrl::class)->resolve($value);
        } catch (UnsafeWebhookUrl) {
            $fail(__('This URL points to a private or invalid address.'));
        }
    }
}
