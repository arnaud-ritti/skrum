<?php

namespace App\Actions\Teams;

use App\Enums\TeamAccessRequestStatus;
use App\Models\Team;
use App\Models\User;
use App\Support\Alphabetical;

class PresentAccessRequestOffer
{
    private const int ManagersShown = 3;

    public function __construct(private AccessRequestRecipients $recipients) {}

    /**
     * @return array{
     *     team: array{id: string, name: string},
     *     workspace: array{name: string},
     *     memberCount: int,
     *     managers: array<int, array{name: string, avatarUrl: string}>,
     *     managersMore: int,
     *     pending: bool,
     *     storeUrl: string
     * }
     */
    public function handle(User $viewer, Team $team): array
    {
        $managers = Alphabetical::sort($this->recipients->for($team), fn (User $manager): string => $manager->name);

        return [
            'team' => ['id' => (string) $team->id, 'name' => $team->name],
            'workspace' => ['name' => $team->workspace->name],
            'memberCount' => $team->members()->count(),
            'managers' => $managers->take(self::ManagersShown)
                ->map(fn (User $manager): array => ['name' => $manager->name, 'avatarUrl' => $manager->avatarUrl()])
                ->values()
                ->all(),
            'managersMore' => max(0, $managers->count() - self::ManagersShown),
            'pending' => $team->accessRequests()
                ->where('user_id', $viewer->id)
                ->where('status', TeamAccessRequestStatus::Pending)
                ->exists(),
            'storeUrl' => route('teams.accessRequests.store', [$team->workspace, $team]),
        ];
    }
}
