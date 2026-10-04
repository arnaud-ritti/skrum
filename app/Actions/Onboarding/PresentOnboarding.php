<?php

namespace App\Actions\Onboarding;

use App\Enums\TeamRole;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\TeamInviteLink;
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
     *     inviteLinkExpiresInDays: int,
     *     inviteLinkUsesCount: int,
     *     membersCount: int
     * }
     */
    public function handle(Onboarding $onboarding, User $user): array
    {
        $workspace = $onboarding->workspace;
        $team = $onboarding->team;
        $link = $team?->usableInviteLink();

        return [
            'step' => $onboarding->step->value,
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
            'inviteLinkExpiresInDays' => $link === null ? TeamInviteLink::ValidForDays : max(1, (int) ceil(now()->diffInDays($link->expires_at))),
            'inviteLinkUsesCount' => $link === null ? 0 : $link->uses_count,
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
