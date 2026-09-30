<?php

namespace App\Mcp\Tools\Retro;

use App\Actions\Retros\BuildInsights;
use App\Enums\CardSentiment;
use App\Enums\McpScope;
use App\Enums\RetroPhase;
use App\Mcp\McpContext;
use App\Mcp\McpFeature;
use App\Mcp\Tools\SkrumTool;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Collection;
use Laravel\Mcp\Request;
use Laravel\Mcp\Response;
use Laravel\Mcp\ResponseFactory;
use Laravel\Mcp\Server\Tools\Annotations\IsOpenWorld;
use Laravel\Mcp\Server\Tools\Annotations\IsReadOnly;

#[IsReadOnly]
#[IsOpenWorld(false)]
class ListInsights extends SkrumTool
{
    protected string $name = 'retro.board.insights.list';

    protected string $description = 'List the insights generated for a board once the team discusses it: themes (groups of related messages with their sentiment) and suggested follow-up actions with their status (pending, promoted or rejected). Empty when nothing was generated.';

    public function __construct(
        private McpContext $context,
        private BuildInsights $buildInsights,
    ) {}

    public function schema(JsonSchema $schema): array
    {
        return [
            'board_id' => $schema->string()->description('The board id (UUID).')->required(),
        ];
    }

    protected function requiredScope(): McpScope
    {
        return McpScope::Read;
    }

    protected function requiredFeature(): ?McpFeature
    {
        return McpFeature::Insights;
    }

    protected function run(Request $request): Response|ResponseFactory
    {
        $validated = $request->validate(['board_id' => ['required', 'uuid']]);
        $retro = $this->context->retro($validated['board_id']);

        $insights = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)
            ? $this->buildInsights->handle($retro)
            : null;

        if ($insights === null) {
            return Response::structured(['status' => 'not_available', 'generatedAt' => null, 'themes' => [], 'suggestedActions' => []]);
        }

        $themeNames = collect($insights['themes'])->pluck('name', 'id');
        $sentiments = $this->sentiments($retro, collect($insights['themes'])->pluck('cardIds')->flatten()->all());

        return Response::structured([
            'status' => $retro->effectiveSummaryStatus()->value ?? 'not_available',
            'generatedAt' => $retro->summary_generated_at?->toIso8601String(),
            'themes' => collect($insights['themes'])->map(fn (array $theme) => [
                'id' => $theme['id'],
                'name' => $theme['name'],
                'messageCount' => count($theme['cardIds']),
                'messageIds' => $theme['cardIds'],
                'sentiment' => [
                    'positive' => collect($theme['cardIds'])->filter(fn (string $id) => $sentiments->get($id) === CardSentiment::Positive)->count(),
                    'neutral' => collect($theme['cardIds'])->filter(fn (string $id) => $sentiments->get($id) === CardSentiment::Neutral)->count(),
                    'negative' => collect($theme['cardIds'])->filter(fn (string $id) => $sentiments->get($id) === CardSentiment::Negative)->count(),
                ],
            ])->values()->all(),
            'suggestedActions' => collect($insights['suggestedActions'])->map(fn (array $suggestion) => [
                ...$suggestion,
                'themeName' => $suggestion['themeId'] === null ? null : $themeNames->get($suggestion['themeId']),
            ])->values()->all(),
        ]);
    }

    /**
     * @param  array<int, string>  $cardIds
     * @return Collection<string, ?CardSentiment>
     */
    private function sentiments(Retro $retro, array $cardIds): Collection
    {
        return Card::query()
            ->where('retro_id', $retro->id)
            ->whereIn('id', $cardIds)
            ->get(['id', 'sentiment'])
            ->mapWithKeys(fn (Card $card): array => [$card->id => $card->sentiment]);
    }
}
