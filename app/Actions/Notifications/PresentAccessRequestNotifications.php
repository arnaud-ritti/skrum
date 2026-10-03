<?php

namespace App\Actions\Notifications;

use App\Enums\TeamAccessRequestStatus;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Notifications\TeamAccessAnsweredNotification;
use App\Notifications\TeamAccessRequestedNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PresentAccessRequestNotifications
{
    public const int ExcerptLength = 120;

    public function __construct(private PresentActor $presentActor) {}

    /**
     * The request is read live. A request to join is shown only to someone
     * who may still add members to its team, an answer only to the person
     * who asked; a request that is gone, with its team, is left out.
     *
     * @param  Collection<int, DatabaseNotification>  $notifications
     * @return array<string, array<string, mixed>>
     */
    public function handle(User $user, Collection $notifications): array
    {
        $kinds = [TeamAccessRequestedNotification::Kind, TeamAccessAnsweredNotification::Kind];

        $relevant = $notifications->filter(
            fn (DatabaseNotification $notification): bool => in_array($notification->data['kind'] ?? null, $kinds, true),
        );

        if ($relevant->isEmpty()) {
            return [];
        }

        $requests = TeamAccessRequest::query()
            ->with(['team.workspace', 'user', 'decidedBy'])
            ->whereKey($relevant->map(fn (DatabaseNotification $notification) => $notification->data['requestId'] ?? null)->filter()->unique()->values())
            ->get()
            ->keyBy('id');

        $managedTeamIds = $requests
            ->pluck('team')
            ->unique('id')
            ->filter(fn ($team): bool => $user->can('manageMembers', $team))
            ->pluck('id')
            ->all();

        $presented = [];

        foreach ($relevant as $notification) {
            $request = $requests->get($notification->data['requestId'] ?? '');

            if ($request === null) {
                continue;
            }

            $present = $notification->data['kind'] === TeamAccessRequestedNotification::Kind
                ? $this->presentRequest($request, $managedTeamIds)
                : $this->presentAnswer($user, $request);

            if ($present === null) {
                continue;
            }

            $presented[$notification->id] = $present;
        }

        return $presented;
    }

    /**
     * @param  array<int, string>  $managedTeamIds
     * @return array{
     *     actor: array{name: string, presence: int, avatarUrl: string}|null,
     *     team: string,
     *     excerpt: ?string,
     *     request: array{
     *         id: string,
     *         status: string,
     *         decidedBy: ?string,
     *         updateUrl: string
     *     },
     *     href: string
     * }|null
     */
    private function presentRequest(TeamAccessRequest $request, array $managedTeamIds): ?array
    {
        if (! in_array($request->team_id, $managedTeamIds, true)) {
            return null;
        }

        return [
            'actor' => $this->presentActor->handle($request->user),
            'team' => $request->team->name,
            'excerpt' => $request->message === null ? null : Str::limit($request->message, self::ExcerptLength),
            'request' => [
                'id' => $request->id,
                'status' => $request->status->value,
                'decidedBy' => $request->decidedBy?->name,
                'updateUrl' => route('teams.accessRequests.update', [$request->team->workspace, $request->team, $request]),
            ],
            'href' => route('teams.show', [$request->team->workspace, $request->team]),
        ];
    }

    /**
     * @return array{
     *     team: string,
     *     outcome: string,
     *     href: string
     * }|null
     */
    private function presentAnswer(User $user, TeamAccessRequest $request): ?array
    {
        if ($request->user_id !== $user->id) {
            return null;
        }

        if ($request->status === TeamAccessRequestStatus::Pending) {
            return null;
        }

        return [
            'team' => $request->team->name,
            'outcome' => $request->status->value,
            'href' => route('teams.show', [$request->team->workspace, $request->team]),
        ];
    }
}
