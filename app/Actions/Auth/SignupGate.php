<?php

namespace App\Actions\Auth;

use App\Enums\SignupMode;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use Illuminate\Support\Str;

class SignupGate
{
    public function __construct(private InstanceSettings $settings) {}

    public function allows(string $email, ?WorkspaceInvitation $invitation = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation) && $invitation->matchesEmail($email)) {
            return true;
        }

        return match ($this->mode()) {
            SignupMode::Open => true,
            SignupMode::Invite => false,
            SignupMode::Domain => $this->hasAllowedDomain($email),
        };
    }

    public function canShowRegistration(?WorkspaceInvitation $invitation = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation)) {
            return true;
        }

        return $this->mode() !== SignupMode::Invite;
    }

    /** The mode stored in General wins over the environment. */
    private function mode(): SignupMode
    {
        return SignupMode::tryFrom($this->settings->signupMode() ?? '') ?? SignupMode::fromConfig();
    }

    private function isFirstUser(): bool
    {
        return User::query()->doesntExist();
    }

    private function isUsableInvitation(?WorkspaceInvitation $invitation): bool
    {
        return $invitation !== null && $invitation->isPending();
    }

    private function hasAllowedDomain(string $email): bool
    {
        $email = trim($email);

        $lastAtPos = strrpos($email, '@');
        if ($lastAtPos === false) {
            return false;
        }

        $localPart = substr($email, 0, $lastAtPos);
        $domain = substr($email, $lastAtPos + 1);

        if ($localPart === '' || $domain === '') {
            return false;
        }

        $domain = Str::lower($domain);

        return in_array($domain, $this->settings->allowedEmailDomains() ?? config('skrum.allowed_email_domains'), true);
    }
}
