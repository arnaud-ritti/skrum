<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\IssuedInvitation;
use App\Actions\Workspaces\SendTeamInvitations;
use App\Enums\OnboardingStep;
use App\Http\Controllers\Concerns\LocksOnboarding;
use App\Http\Requests\Invitations\TeamInvitationRequest;
use App\Models\Team;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class OnboardingInvitationsController extends Controller
{
    use LocksOnboarding;

    public function store(TeamInvitationRequest $request, SendTeamInvitations $sendInvitations): RedirectResponse
    {
        $user = $request->user();

        $team = DB::transaction(function () use ($user): Team {
            $onboarding = $this->lockedOnboarding($user);
            $team = $onboarding->team;

            if ($onboarding->step !== OnboardingStep::Invite || $team === null) {
                throw ValidationException::withMessages(['emails' => __('This step is not available.')]);
            }

            return $team;
        });

        abort_unless($user->can('invite', $team), 403);

        $issued = $sendInvitations->handle($team, $user, $request->emails(), $request->teamRole(), $request->message());

        DB::transaction(function () use ($user): void {
            $onboarding = $this->lockedOnboarding($user);

            if ($onboarding->step !== OnboardingStep::Invite) {
                return;
            }

            $onboarding->update(['step' => OnboardingStep::Ritual]);
        });

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrls', array_map(fn (IssuedInvitation $invitation): string => $invitation->url(), $issued));
        }

        Inertia::flash('invitationsSent', count($issued));

        return to_route('onboarding.show');
    }
}
