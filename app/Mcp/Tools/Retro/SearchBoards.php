<?php

namespace App\Mcp\Tools\Retro;

use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Mcp\McpContext;
use App\Mcp\McpGrant;
use App\Mcp\Presenters\McpBoard;
use App\Mcp\Support\LikePattern;
use App\Mcp\Tools\SkrumTool;
use App\Mcp\VisibleTeams;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Database\SearchText;
use App\Support\Llm\Llm;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class SearchBoards extends SkrumTool
{
    private const int MaxLimit = 20;

    private const int PerMinute = 20;

    private const int MatchesPerKind = 5;

    private const int MaxRowsPerKind = 200;

    protected string $name = 'retro.boards.search';

    protected string $description = 'Search your teams\' boards by keyword (case-insensitive) across board titles, summaries, action items and messages. Messages that are still hidden on the board are never searched. Returns each matching board with short snippets.';

    public function __construct(
        private McpContext $context,
        private VisibleTeams $visibleTeams,
        private McpBoard $presentBoard,
        private Llm $llm,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->min(2)->max(100)->description('Keywords to look for.')->required(),
            'team_id' => $schema->string()->description('Only this team (UUID).'),
            'limit' => $schema->integer()->min(1)->max(self::MaxLimit)->default(self::MaxLimit),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:100'],
            'team_id' => ['nullable', 'uuid'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:'.self::MaxLimit],
        ]);

        $grant = McpGrant::current();
        $key = "mcp-search:{$grant->tokenId}";

        abort_if(RateLimiter::tooManyAttempts($key, self::PerMinute), 429, __('Too many searches, wait a moment.'));

        RateLimiter::hit($key);

        $teamIds = isset($validated['team_id'])
            ? [$this->context->team($validated['team_id'])->id]
            : $this->visibleTeams->ids($grant);
        $term = $validated['query'];
        $retroIds = Retro::query()->whereIn('team_id', $teamIds)->select('id');

        $matches = collect()
            ->concat($this->titles($retroIds, $term))
            ->concat($this->summaries($retroIds, $term))
            ->concat($this->actions($retroIds, $term))
            ->concat($this->messages($retroIds, $term, $grant))
            ->groupBy('retroId');

        $retros = Retro::query()
            ->whereIn('id', $matches->keys())
            ->latest()
            ->orderByDesc('id')
            ->limit((int) ($validated['limit'] ?? self::MaxLimit))
            ->get();

        return Response::structured([
            'results' => $retros->map(fn (Retro $retro): array => [
                'board' => $this->presentBoard->handle($retro),
                'matches' => $matches->get($retro->id, collect())
                    ->map(fn (array $match): array => ['kind' => $match['kind'], 'id' => $match['id'], 'snippet' => $match['snippet']])
                    ->values()
                    ->all(),
            ])->values()->all(),
        ]);
    }

    /**
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: 'title', id: null, snippet: string}>
     */
    private function titles(Builder $retroIds, string $term): Collection
    {
        return Retro::query()
            ->whereIn('id', $retroIds)
            ->whereContains('title', $term)
            ->latest()
            ->limit(self::MaxRowsPerKind)
            ->get(['id', 'title'])
            ->filter(fn (Retro $retro): bool => SearchText::contains($retro->title, $term))
            ->map(fn (Retro $retro): array => ['retroId' => $retro->id, 'kind' => 'title', 'id' => null, 'snippet' => LikePattern::snippet($retro->title, $term)]);
    }

    /**
     * Summaries are shown only on finished boards that kept them, are ready and
     * have a configured provider (same rule as the summary tool).
     *
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: 'summary', id: null, snippet: string}>
     */
    private function summaries(Builder $retroIds, string $term): Collection
    {
        if ($this->llm->providerName() === null) {
            return collect();
        }

        return Retro::query()
            ->whereIn('id', $retroIds)
            ->where('phase', RetroPhase::Completed)
            ->where('ai_summary_enabled', true)
            ->where('summary_status', SummaryStatus::Ready)
            ->whereContains('summary', $term)
            ->latest()
            ->limit(self::MaxRowsPerKind)
            ->get(['id', 'summary'])
            ->filter(fn (Retro $retro): bool => SearchText::contains($retro->summary, $term))
            ->map(fn (Retro $retro): array => ['retroId' => $retro->id, 'kind' => 'summary', 'id' => null, 'snippet' => LikePattern::snippet((string) $retro->summary, $term)]);
    }

    /**
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: 'action', id: string, snippet: string}>
     */
    private function actions(Builder $retroIds, string $term): Collection
    {
        return ActionItem::query()
            ->whereIn('retro_id', $retroIds)
            ->whereContains('content', $term)->latest()
            ->orderByDesc('id')
            ->limit(self::MaxRowsPerKind)
            ->get(['id', 'retro_id', 'content', 'created_at'])
            ->filter(fn (ActionItem $item): bool => SearchText::contains($item->content, $term))
            ->reverse()
            ->groupBy('retro_id')
            ->flatMap(fn (Collection $items) => $items->take(self::MatchesPerKind))
            ->map(fn (ActionItem $item): array => ['retroId' => (string) $item->retro_id, 'kind' => 'action', 'id' => $item->id, 'snippet' => LikePattern::snippet($item->content, $term)]);
    }

    /**
     * Cards others are still writing are excluded in SQL, exactly the ones
     * the board hides (PresentCard), so hidden text can never match.
     *
     * @param  Builder<Retro>  $retroIds
     * @return Collection<int, array{retroId: string, kind: 'message', id: string, snippet: string}>
     */
    private function messages(Builder $retroIds, string $term, McpGrant $grant): Collection
    {
        $ownParticipantIds = Participant::query()->where('user_id', $grant->user->id)->select('id');
        $hidingRetroIds = Retro::query()->whereIn('phase', RetroPhase::hidingOthersCards())->select('id');

        return Card::query()
            ->whereIn('retro_id', $retroIds)
            ->whereContains('content', $term)
            ->where(fn (Builder $query) => $query
                ->whereNotIn('retro_id', $hidingRetroIds)
                ->orWhereIn('participant_id', $ownParticipantIds))->latest()
            ->orderByDesc('id')
            ->limit(self::MaxRowsPerKind)
            ->get(['id', 'retro_id', 'content', 'position'])
            ->filter(fn (Card $card): bool => SearchText::contains($card->content, $term))
            ->sortBy('position')
            ->groupBy('retro_id')
            ->flatMap(fn (Collection $cards) => $cards->take(self::MatchesPerKind))
            ->map(fn (Card $card): array => ['retroId' => $card->retro_id, 'kind' => 'message', 'id' => $card->id, 'snippet' => LikePattern::snippet((string) $card->content, $term)]);
    }
}
