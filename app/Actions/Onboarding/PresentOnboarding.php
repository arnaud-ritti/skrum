<?php

namespace App\Actions\Onboarding;

use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Teams\TeamMark;

class PresentOnboarding
{
    /** Each language in its own name, as the language switcher shows it. */
    private const array LocaleNames = [
        'en' => 'English',
        'fr' => 'Français',
        'es' => 'Español',
        'de' => 'Deutsch',
    ];

    /**
     * @return array{
     *     step: string,
     *     canEditWorkspace: bool,
     *     workspace: array{name: string, slug: string, locale: ?string}|null,
     *     team: array{id: string, name: string, slug: string, color: string, description: ?string}|null,
     *     teamAddressBase: string,
     *     teamName: ?string,
     *     defaultColor: string,
     *     languages: array<int, array{value: string, label: string}>,
     *     userLocale: string,
     *     inviteRoles: array<int, string>,
     *     invitedCount: int,
     *     inviteLinkUrl: ?string,
     *     inviteLinkExpiresAt: ?string,
     *     inviteLinkUsesCount: int,
     *     hasHadInviteLink: bool,
     *     membersCount: int
     * }
     */
    public function handle(Onboarding $onboarding, User $user): array
    {
        $workspace = $onboarding->workspace;
        $team = $onboarding->team;
        $link = $team?->usableInviteLink();

        return [
            'step' => $workspace === null ? OnboardingStep::Workspace->value : $onboarding->step->value,
            'canEditWorkspace' => $workspace === null || $user->roleIn($workspace) === WorkspaceRole::Owner,
            'workspace' => $workspace === null ? null : [
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'locale' => $workspace->locale,
            ],
            'team' => $team === null ? null : [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'color' => TeamMark::colorFor($team)->value,
                'description' => $team->description,
            ],
            'teamAddressBase' => url('t').'/',
            'teamName' => $team === null ? $onboarding->team_name : null,
            'defaultColor' => TeamMark::derived($onboarding->workspace_id ?? $user->id)->value,
            'languages' => $this->languages(),
            'userLocale' => $user->locale ?? app()->getLocale(),
            'inviteRoles' => array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()),
            'invitedCount' => $team === null ? 0 : $this->pendingInvitationsCount($team),
            'inviteLinkUrl' => $link?->url(),
            'inviteLinkExpiresAt' => $link?->expires_at?->toIso8601String(),
            'inviteLinkUsesCount' => $link === null ? 0 : $link->uses_count,
            'hasHadInviteLink' => $team !== null && $team->inviteLinks()->exists(),
            'membersCount' => $team === null ? 0 : $team->members()->count(),
        ];
    }

    /** @return array<int, array{value: string, label: string}> */
    private function languages(): array
    {
        /** @var array<int, string> $locales */
        $locales = config('skrum.locales');

        return array_map(fn (string $locale): array => [
            'value' => $locale,
            'label' => self::LocaleNames[$locale] ?? $locale,
        ], $locales);
    }

    private function pendingInvitationsCount(Team $team): int
    {
        return $team->invitations()
            ->whereNull('accepted_at')
            ->whereNull('declined_at')
            ->get()
            ->filter(fn (WorkspaceInvitation $invitation): bool => $invitation->isPending())
            ->count();
    }
}
