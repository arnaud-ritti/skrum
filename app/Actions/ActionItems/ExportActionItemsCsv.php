<?php

namespace App\Actions\ActionItems;

use App\Actions\Integrations\BuildRetroRecap;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CsvCell;
use Generator;
use Illuminate\Support\Str;

class ExportActionItemsCsv
{
    private const int ChunkSize = 200;

    public function __construct(
        private ActionItemQuery $actionItemQuery,
        private BuildRetroRecap $buildRetroRecap,
    ) {}

    /**
     * Spec 24 §6.6: the header, then every item the viewer sees under the filters, in the
     * order of the page, read in chunks.
     *
     * @return Generator<int, array<int, string>>
     */
    public function rows(User $user, Workspace $workspace, ActionItemFilters $filters): Generator
    {
        yield $this->header();

        $query = ActionItemQuery::order($this->actionItemQuery->filter($this->actionItemQuery->visibleTo($user, $workspace), $user, $filters))
            ->with(['team', 'retro', 'assigneeUser', 'assigneeParticipant', 'externalLinks']);

        foreach ($query->lazy(self::ChunkSize) as $item) {
            yield array_map(CsvCell::safe(...), $this->cells($item, $workspace));
        }
    }

    public function fileName(Workspace $workspace): string
    {
        $slug = Str::slug($workspace->slug) ?: 'workspace';

        return "action-items-{$slug}-".now()->format('Y-m-d').'.csv';
    }

    /**
     * @return array<int, string>
     */
    private function header(): array
    {
        return [
            __('Action'), __('Status'), __('Team'), __('Assignee'), __('Priority'), __('Due date'),
            __('Source'), __('Created'), __('Completed'), __('Tickets'), __('Link'),
        ];
    }

    /**
     * @return array<int, string>
     */
    private function cells(ActionItem $item, Workspace $workspace): array
    {
        return [
            $item->content,
            $item->currentStatus()->label(),
            $item->team->name,
            (string) $this->buildRetroRecap->assignee($item),
            $item->priority->label(),
            (string) $item->due_on?->toDateString(),
            $item->retro === null ? __('Added outside a retro') : $item->retro->title,
            (string) $item->created_at?->toDateString(),
            (string) $item->completed_at?->toDateString(),
            $item->externalLinks
                ->sortBy(fn (ActionItemExternalLink $link): string => $link->source->value)
                ->pluck('external_key')
                ->implode(' | '),
            route('workspaces.actionItems.index', ['workspace' => $workspace, 'item' => $item->id]),
        ];
    }
}
