<?php

namespace App\Actions\Auth;

use App\Enums\SignupMode;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Str;

class SignupGate
{
    public function allows(string $email, ?WorkspaceInvitation $invitation = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation) && $invitation->matchesEmail($email)) {
            return true;
        }

        return match (SignupMode::fromConfig()) {
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

        return SignupMode::fromConfig() !== SignupMode::Invite;
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

        return in_array($domain, config('skrum.allowed_email_domains'), true);
    }
}
