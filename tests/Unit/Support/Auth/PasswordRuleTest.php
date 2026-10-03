<?php

use App\Support\Auth\PasswordRule;

it('checks breaches in production when the switch is on', function () {
    expect(PasswordRule::defaults(production: true, breachCheck: true)->appliedRules()['uncompromised'])->toBeTrue()
        ->and(PasswordRule::defaults(production: true, breachCheck: false)->appliedRules()['uncompromised'])->toBeFalse()
        ->and(PasswordRule::defaults(production: true, breachCheck: false)->appliedRules()['min'])->toBe(12)
        ->and(PasswordRule::defaults(production: false, breachCheck: true))->toBeNull();
});
