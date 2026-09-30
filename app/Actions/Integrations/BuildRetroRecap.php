<?php

namespace App\Actions\Integrations;

use App\Actions\Retros\SummarizeRoti;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Integrations\Messages\RetroRecap;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Reads only what the Results view shows of a completed retro, without
 * any card author, voter, comment, survey, health answer or theme.
 */
class BuildRetroRecap
{
    public const ActionItemLimit = 10;

    public const SuggestedActionLimit = 5;

    public const CardContentLimit = 300;

    public function __construct(private SummarizeRoti $summarizeRoti) {}

    public function handle(Retro $retro): RetroRecap
    {
        $retro->loadMissing(['team', 'participants.user']);

        $roti = $this->summarizeRoti->handle($retro);
        $actionItems = $this->actionItems($retro);
        $suggestedActions = $retro->suggestedActions()
            ->where('status', SuggestedActionStatus::Pending->value)
            ->pluck('content')
            ->map(fn (mixed $content): string => Str::squish((string) $content));

        return new RetroRecap(
            title: $retro->title,
            teamName: $retro->team->name,
            completedOn: $this->date($retro->completed_at ?? now()),
            url: route('retros.show', $retro),
            participantCount: $retro->participants->count(),
            participantNames: $retro->is_anonymous ? null : $this->participantNames($retro),
            cardCount: $retro->cards()->count(),
            rotiAverage: $roti['respondents'] > 0 ? $roti['average'] : null,
            rotiRespondents: $roti['respondents'],
            summary: $this->summary($retro),
            actionItems: $actionItems->take(self::ActionItemLimit)->values()->all(),
            hiddenActionItems: max(0, $actionItems->count() - self::ActionItemLimit),
            suggestedActions: $suggestedActions->take(self::SuggestedActionLimit)->values()->all(),
            hiddenSuggestedActions: max(0, $suggestedActions->count() - self::SuggestedActionLimit),
            topCards: $this->topCards($retro),
        );
    }

    /**
     * @return array<int, string>
     */
    private function participantNames(Retro $retro): array
    {
        return $retro->participants
            ->map(fn (Participant $participant): string => $participant->isGuest()
                ? __(':name (guest)', ['name' => $participant->displayName()])
                : $participant->displayName())
            ->sort(fn (string $first, string $second): int => strcasecmp($first, $second))
            ->values()
            ->all();
    }

    private function summary(Retro $retro): ?string
    {
        if ($retro->effectiveSummaryStatus() !== SummaryStatus::Ready || blank($retro->summary)) {
            return null;
        }

        return trim($retro->summary);
    }

    /**
     * @return Collection<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool}>
     */
    private function actionItems(Retro $retro): Collection
    {
        return $retro->actionItems()
            ->with(['assigneeUser', 'assigneeParticipant.user'])
            ->get()
            ->sortBy([
                fn (ActionItem $first, ActionItem $second): int => $first->isCompleted() <=> $second->isCompleted(),
                fn (ActionItem $first, ActionItem $second): int => $first->priority->sortWeight() <=> $second->priority->sortWeight(),
                fn (ActionItem $first, ActionItem $second): int => $first->created_at <=> $second->created_at,
            ])
            ->map(fn (ActionItem $item): array => [
                'content' => Str::squish($item->content),
                'assignee' => $this->assignee($item),
                'dueOn' => $item->due_on === null ? null : $this->date($item->due_on),
                'isCompleted' => $item->isCompleted(),
            ])
            ->values();
    }

    private function assignee(ActionItem $item): ?string
    {
        if ($item->assigneeUser !== null) {
            return $item->assigneeUser->name;
        }

        $participant = $item->assigneeParticipant;

        if ($participant === null) {
            return null;
        }

        return $participant->isGuest()
            ? __(':name (guest)', ['name' => $participant->displayName()])
            : $participant->displayName();
    }

    /**
     * @return array<int, array{column: string, content: string, votes: int, groupedCount: int}>
     */
    private function topCards(Retro $retro): array
    {
        $cardsByColumn = Card::query()
            ->where('retro_id', $retro->id)
            ->whereNull('parent_card_id')
            ->withCount(['votes', 'children'])
            ->get()
            ->groupBy('column_id');

        return $retro->columns()->get()
            ->map(function (Column $column) use ($cardsByColumn): ?array {
                /** @var Collection<int, Card> $cards */
                $cards = $cardsByColumn->get($column->id) ?? collect();

                $top = $cards
                    ->filter(fn (Card $card): bool => (int) $card->getAttribute('votes_count') > 0)
                    ->sortBy([
                        fn (Card $first, Card $second): int => (int) $second->getAttribute('votes_count') <=> (int) $first->getAttribute('votes_count'),
                        fn (Card $first, Card $second): int => $first->position <=> $second->position,
                    ])
                    ->first();

                if ($top === null) {
                    return null;
                }

                $content = $top->content === null || trim($top->content) === ''
                    ? __('A card without text')
                    : Str::squish($top->content);

                return [
                    'column' => $column->title,
                    'content' => Str::limit($content, self::CardContentLimit - 1, '…'),
                    'votes' => (int) $top->getAttribute('votes_count'),
                    'groupedCount' => (int) $top->getAttribute('children_count'),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function date(CarbonInterface $date): string
    {
        return $date->copy()->locale(app()->getLocale())->isoFormat('LL');
    }
}
