<?php

namespace App\Http\Requests\Invitations;

use App\Enums\TeamRole;
use App\Models\Team;
use App\Support\Auth\LoginAddress;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamInvitationRequest extends FormRequest
{
    public const int MaxAddresses = 20;

    public const int MaxMessageLength = 500;

    /**
     * A request without a team in its route is the onboarding's step 3,
     * whose controller authorises against the onboarding's team.
     */
    public function authorize(): bool
    {
        $team = $this->route('team');

        if ($team === null) {
            return true;
        }

        if (! $team instanceof Team) {
            return false;
        }

        return $this->user()?->can('invite', $team) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $emails = $this->input('emails');

        if (! is_array($emails)) {
            return;
        }

        foreach ($emails as $email) {
            if (! is_string($email)) {
                return;
            }
        }

        $this->merge([
            'emails' => array_map(LoginAddress::normalise(...), $emails),
        ]);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'emails' => ['required', 'array', 'min:1', 'max:'.self::MaxAddresses],
            'emails.*' => ['required', 'string', 'email:rfc,filter', 'max:255'],
            'role' => ['required', Rule::in(array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()))],
            'message' => ['nullable', 'string', 'max:'.self::MaxMessageLength],
        ];
    }

    /**
     * Distinct addresses, each keyed by the index of its chip, so that an
     * error names the chip that was submitted.
     *
     * @return array<int, string>
     */
    public function emails(): array
    {
        /** @var array<int, string> $emails */
        $emails = $this->validated('emails');

        return array_unique($emails);
    }

    public function teamRole(): TeamRole
    {
        return TeamRole::from($this->string('role')->value());
    }

    public function message(): ?string
    {
        $message = $this->validated('message');

        return is_string($message) ? $message : null;
    }
}
