<?php

use App\Actions\Auth\SignupGate;
use App\Models\User;
use App\Models\WorkspaceInvitation;

function signupGate(): SignupGate
{
    return resolve(SignupGate::class);
}

it('always allows the very first user', function (string $mode) {
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => []]);

    expect(signupGate()->allows('first@example.com'))->toBeTrue()
        ->and(signupGate()->canShowRegistration())->toBeTrue();
})->with(['open', 'invite', 'domain']);

it('decides by mode once users exist', function (string $mode, string $email, bool $expected) {
    User::factory()->create();
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => ['acme.test']]);

    expect(signupGate()->allows($email))->toBe($expected);
})->with([
    'open allows anyone' => ['open', 'someone@else.test', true],
    'invite refuses without invitation' => ['invite', 'someone@acme.test', false],
    'domain allows listed domain' => ['domain', 'someone@acme.test', true],
    'domain allows listed domain case-insensitively' => ['domain', 'someone@ACME.test', true],
    'domain refuses other domains' => ['domain', 'someone@else.test', false],
    'unknown mode behaves like invite' => ['nonsense', 'someone@acme.test', false],
]);

it('allows a matching pending invitation in invite and domain modes', function (string $mode) {
    User::factory()->create();
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => ['acme.test']]);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'Guest@Else.test']);

    expect(signupGate()->allows('guest@else.test', $invitation))->toBeTrue()
        ->and(signupGate()->canShowRegistration($invitation))->toBeTrue();
})->with(['invite', 'domain']);

it('refuses invitations that do not match, expired or were accepted', function (WorkspaceInvitation $invitation) {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);

    expect(signupGate()->allows('guest@else.test', $invitation))->toBeFalse();
})->with([
    'other email' => fn () => WorkspaceInvitation::factory()->create(['email' => 'other@else.test']),
    'expired' => fn () => WorkspaceInvitation::factory()->expired()->create(['email' => 'guest@else.test']),
    'accepted' => fn () => WorkspaceInvitation::factory()->accepted()->create(['email' => 'guest@else.test']),
]);

it('hides registration in invite mode without a pending invitation', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'invite']);

    expect(signupGate()->canShowRegistration())->toBeFalse()
        ->and(signupGate()->canShowRegistration(WorkspaceInvitation::factory()->expired()->create()))->toBeFalse();
});

it('shows registration in open and domain modes', function (string $mode) {
    User::factory()->create();
    config(['skrum.signup_mode' => $mode]);

    expect(signupGate()->canShowRegistration())->toBeTrue();
})->with(['open', 'domain']);

it('handles adversarial email inputs in domain mode', function (string $email, bool $expected) {
    User::factory()->create();
    config(['skrum.signup_mode' => 'domain', 'skrum.allowed_email_domains' => ['acme.test']]);

    expect(signupGate()->allows($email))->toBe($expected);
})->with([
    'no @ symbol' => ['acme.test', false],
    'empty local part' => ['@acme.test', false],
    'empty domain part' => ['user@', false],
    'multiple @ uses last one' => ['evil@x.test@acme.test', true],
    'subdomain not allowed' => ['x@sub.acme.test', false],
    'trailing dot rejected' => ['x@acme.test.', false],
    'trimmed whitespace accepted' => ['  x@acme.test  ', true],
]);

it('allows matching invitation in open mode', function () {
    User::factory()->create();
    config(['skrum.signup_mode' => 'open']);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'Guest@Example.com']);

    expect(signupGate()->allows('guest@example.com', $invitation))->toBeTrue();
});

it('parses allowed email domains from environment', function () {
    $previous = getenv('SKRUM_ALLOWED_EMAIL_DOMAINS');
    putenv('SKRUM_ALLOWED_EMAIL_DOMAINS= ACME.test, ,foo.test');

    try {
        $config = require config_path('skrum.php');
    } finally {
        putenv($previous === false ? 'SKRUM_ALLOWED_EMAIL_DOMAINS' : "SKRUM_ALLOWED_EMAIL_DOMAINS={$previous}");
    }

    expect($config['allowed_email_domains'])->toBe(['acme.test', 'foo.test']);
});
