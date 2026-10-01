<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Actions\Integrations\LinkStatusSync;
use App\Enums\ActionItemStatus;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\ActionItemSubtask;
use Carbon\CarbonInterface;

class PresentActionItem
{
    public function __construct(private ActionItemPermissions $permissions) {}

    /**
     * Creators and assignees are always named, also on anonymous retros. External issue links are for members: guests get none, and payloads presented without a viewer (broadcasts) carry null so clients keep what they know; so is `completedVia`.
     *
     * @return array{
     *     id: string,
     *     retroId: ?string,
     *     teamId: string,
     *     content: string,
     *     priority: string,
     *     dueOn: ?string,
     *     isOverdue: bool,
     *     status: string,
     *     completedAt: ?string,
     *     completedVia: ?string,
     *     assignee: ?array{kind: string, id: string, name: string, avatarUrl: string, isTeamMember: bool},
     *     createdBy: ?array{name: string, avatarUrl: string},
     *     isMine: bool,
     *     commentCount: int,
     *     source: ?array{retroTitle: string, retroCreatedAt: ?string, retroUrl: string},
     *     themeId: ?string,
     *     themeName: ?string,
     *     recurrence: ?string,
     *     previousOccurrenceId: ?string,
     *     subtasks: array<int, array{id: string, content: string, isCompleted: bool, position: int}>,
     *     externalLinks: ?array<int, array{id: string, source: string, key: string, url: string, state: ?string, statusName: ?string, syncState: string, syncError: ?string, lastSyncedAt: ?string}>,
     *     createdAt: ?string
     * }
     */
    public function handle(ActionItem $item, ?ActionItemActor $viewer = null, ?CarbonInterface $today = null): array
    {
        return [
            'id' => $item->id,
            'retroId' => $item->retro_id,
            'teamId' => $item->team_id,
            'content' => $item->content,
            'priority' => $item->priority->value,
            'dueOn' => $item->due_on?->toDateString(),
            'isOverdue' => $item->isOverdue($today ?? ActionItem::today()),
            'status' => $item->isCompleted() ? ActionItemStatus::Completed->value : ActionItemStatus::Open->value,
            'completedAt' => $item->completed_at?->toIso8601String(),
            'completedVia' => $viewer?->user === null ? null : $item->completed_via_source,
            'assignee' => $this->assignee($item),
            'createdBy' => $this->createdBy($item),
            'isMine' => $viewer !== null && $this->permissions->isAuthor($item, $viewer),
            'commentCount' => (int) ($item->comments_count ?? $item->comments()->count()),
            'source' => $this->source($item),
            'themeId' => $item->theme_id,
            'themeName' => $item->theme_name,
            'recurrence' => $item->recurrence?->value,
            'previousOccurrenceId' => $item->previous_occurrence_id,
            'subtasks' => $item->subtasks
                ->map(fn (ActionItemSubtask $subtask): array => [
                    'id' => $subtask->id,
                    'content' => $subtask->content,
                    'isCompleted' => $subtask->isCompleted(),
                    'position' => $subtask->position,
                ])
                ->values()
                ->all(),
            'createdAt' => $item->created_at?->toIso8601String(),
            'externalLinks' => $this->externalLinksFor($item, $viewer),
        ];
    }

    /**
     * @return array<int, array{id: string, source: string, key: string, url: string, state: ?string, statusName: ?string, syncState: string, syncError: ?string, lastSyncedAt: ?string}>
     */
    public function presentExternalLinks(ActionItem $item): array
    {
        return $item->externalLinks
            ->sortBy(fn (ActionItemExternalLink $link): string => $link->source->value)
            ->map(function (ActionItemExternalLink $link) use ($item): array {
                $syncState = LinkStatusSync::state($link, $item);

                return [
                    'id' => $link->id,
                    'source' => $link->source->value,
                    'key' => $link->external_key,
                    'url' => $link->external_url,
                    'state' => $link->external_state?->value,
                    'statusName' => $link->external_status_name,
                    'syncState' => $syncState,
                    'syncError' => $syncState === LinkStatusSync::Failed ? $link->sync_error : null,
                    'lastSyncedAt' => $link->last_synced_at?->toIso8601String(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * @param  iterable<ActionItem>  $items
     * @return array<int, array<string, mixed>>
     */
    public function many(iterable $items, ?ActionItemActor $viewer = null): array
    {
        $today = ActionItem::today();
        $presented = [];

        foreach ($items as $item) {
            $presented[] = $this->handle($item, $viewer, $today);
        }

        return $presented;
    }

    /**
     * @return ?array<int, array{id: string, source: string, key: string, url: string, state: ?string, statusName: ?string, syncState: string, syncError: ?string, lastSyncedAt: ?string}>
     */
    private function externalLinksFor(ActionItem $item, ?ActionItemActor $viewer): ?array
    {
        if ($viewer === null) {
            return null;
        }

        if ($viewer->user === null) {
            return [];
        }

        return $this->presentExternalLinks($item);
    }

    /**
     * @return ?array{kind: string, id: string, name: string, avatarUrl: string, isTeamMember: bool}
     */
    private function assignee(ActionItem $item): ?array
    {
        $user = $item->assigneeUser;

        if ($user !== null) {
            return [
                'kind' => 'member',
                'id' => $user->id,
                'name' => $user->name,
                'avatarUrl' => $user->avatarUrl(),
                'isTeamMember' => $item->team->members->contains('id', $user->id),
            ];
        }

        $participant = $item->assigneeParticipant;

        if ($participant === null) {
            return null;
        }

        return [
            'kind' => 'guest',
            'id' => $participant->id,
            'name' => $participant->displayName(),
            'avatarUrl' => $participant->avatarUrl(),
            'isTeamMember' => false,
        ];
    }

    /**
     * @return ?array{name: string, avatarUrl: string}
     */
    private function createdBy(ActionItem $item): ?array
    {
        $participant = $item->createdByParticipant;

        if ($participant !== null) {
            return ['name' => $participant->displayName(), 'avatarUrl' => $participant->avatarUrl()];
        }

        $author = $item->author;

        if ($author === null) {
            return null;
        }

        return ['name' => $author->name, 'avatarUrl' => $author->avatarUrl()];
    }

    /**
     * @return ?array{retroTitle: string, retroCreatedAt: ?string, retroUrl: string}
     */
    private function source(ActionItem $item): ?array
    {
        $retro = $item->retro;

        if ($retro === null) {
            return null;
        }

        return [
            'retroTitle' => $retro->title,
            'retroCreatedAt' => $retro->created_at?->toIso8601String(),
            'retroUrl' => route('retros.show', $retro),
        ];
    }
}
