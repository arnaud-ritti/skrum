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
use App\Support\Avatars\AvatarUrl;
use App\Support\Integrations\Messages\RetroRecap;
use App\Support\Integrations\Messages\RetroRecapContent;
use App\Support\Mail\MailBrand;
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

    public const RotiBarsMinimumVotes = 3;

    private const string MachineGuestSuffix = '(guest)';

    public function __construct(private SummarizeRoti $summarizeRoti, private AvatarUrl $avatarUrl) {}

    public function handle(Retro $retro): RetroRecap
    {
        $retro->loadMissing(['team', 'participants.user', 'facilitator.user']);

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
            facilitatorName: $retro->is_anonymous ? null : $retro->facilitator?->displayName(),
            rotiCounts: $this->rotiCounts($roti),
            completedDay: ($retro->completed_at ?? now())->copy()->locale(app()->getLocale())->isoFormat('dddd D MMMM'),
        );
    }

    /**
     * The recap for every channel, with the structured form the generic
     * webhook sends (spec 8 §4.5), from one read of the retro.
     */
    public function content(Retro $retro): RetroRecapContent
    {
        $recap = $this->handle($retro);

        return new RetroRecapContent($recap, $this->webhookData($retro, $recap));
    }

    /**
     * @return array<int, string>
     */
    private function participantNames(Retro $retro, bool $forMachines = false): array
    {
        return $retro->participants
            ->map(fn (Participant $participant): string => $this->participantName($participant, $forMachines))
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
     * @return Collection<int, ActionItem>
     */
    private function sortedActionItems(Retro $retro): Collection
    {
        return $retro->actionItems()
            ->with(['assigneeUser', 'assigneeParticipant.user'])
            ->get()
            ->sortBy([
                fn (ActionItem $first, ActionItem $second): int => $first->isCompleted() <=> $second->isCompleted(),
                fn (ActionItem $first, ActionItem $second): int => $first->priority->sortWeight() <=> $second->priority->sortWeight(),
                fn (ActionItem $first, ActionItem $second): int => $first->created_at <=> $second->created_at,
            ])
            ->values();
    }

    /**
     * The bars would show who voted what in a very small group.
     *
     * @param  array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int}  $roti
     * @return array{1: int, 2: int, 3: int, 4: int, 5: int}|null
     */
    private function rotiCounts(array $roti): ?array
    {
        if ($roti['respondents'] < self::RotiBarsMinimumVotes) {
            return null;
        }

        /** @var array{1: int, 2: int, 3: int, 4: int, 5: int} */
        return array_column($roti['distribution'], 'count', 'score');
    }

    /**
     * @return Collection<int, array{content: string, assignee: ?string, dueOn: ?string, isCompleted: bool, assigneeInitials: ?string, assigneePresence: ?int, dueDay: ?string}>
     */
    private function actionItems(Retro $retro): Collection
    {
        return $this->sortedActionItems($retro)
            ->map(function (ActionItem $item): array {
                $assignee = $this->assignee($item);

                return [
                    'content' => Str::squish($item->content),
                    'assignee' => $assignee,
                    'dueOn' => $item->due_on === null ? null : $this->date($item->due_on),
                    'isCompleted' => $item->isCompleted(),
                    'assigneeInitials' => $this->assigneeInitials($item),
                    'assigneePresence' => $this->assigneePresence($item),
                    'dueDay' => $item->due_on?->copy()->locale(app()->getLocale())->isoFormat('D MMM'),
                ];
            })
            ->values();
    }

    private function assigneeInitials(ActionItem $item): ?string
    {
        $name = $item->assigneeUser?->name ?? $item->assigneeParticipant?->displayName();

        return $name === null ? null : $this->avatarUrl->initials($name);
    }

    private function assigneePresence(ActionItem $item): ?int
    {
        $seed = $item->assigneeUser?->avatarSeed() ?? $item->assigneeParticipant?->avatarSeed();

        return $seed === null ? null : MailBrand::presence($seed);
    }

    /**
     * @return array<string, mixed>
     */
    private function webhookData(Retro $retro, RetroRecap $recap): array
    {
        $actionItems = $this->sortedActionItems($retro);

        return [
            'title' => $recap->title,
            'url' => $recap->url,
            'completedAt' => ($retro->completed_at ?? now())->toIso8601ZuluString(),
            'participants' => [
                'count' => $recap->participantCount,
                'names' => $retro->is_anonymous ? null : $this->participantNames($retro, forMachines: true),
            ],
            'cardCount' => $recap->cardCount,
            'roti' => $recap->rotiAverage === null ? null : [
                'average' => round($recap->rotiAverage, 1),
                'respondents' => $recap->rotiRespondents,
            ],
            'summary' => $recap->summary,
            'actionItems' => $actionItems->take(self::ActionItemLimit)
                ->map(fn (ActionItem $item): array => [
                    'content' => Str::squish($item->content),
                    'assignee' => $this->assignee($item, forMachines: true),
                    'dueOn' => $item->due_on?->toDateString(),
                    'priority' => $item->priority->value,
                    'isCompleted' => $item->isCompleted(),
                ])
                ->values()
                ->all(),
            'moreActionItems' => max(0, $actionItems->count() - self::ActionItemLimit),
            'suggestedActions' => $recap->suggestedActions,
            'topCards' => $recap->topCards,
        ];
    }

    public function assignee(ActionItem $item, bool $forMachines = false): ?string
    {
        if ($item->assigneeUser !== null) {
            return $item->assigneeUser->name;
        }

        $participant = $item->assigneeParticipant;

        if ($participant === null) {
            return null;
        }

        return $this->participantName($participant, $forMachines);
    }

    private function participantName(Participant $participant, bool $forMachines): string
    {
        if (! $participant->isGuest()) {
            return $participant->displayName();
        }

        return $forMachines
            ? "{$participant->displayName()} ".self::MachineGuestSuffix
            : __(':name (guest)', ['name' => $participant->displayName()]);
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
