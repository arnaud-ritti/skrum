<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;
use App\Support\Llm\Llm;

class BuildInsights
{
    public function __construct(
        private PresentSuggestedAction $presentSuggestedAction,
        private Llm $llm,
    ) {}

    /**
     * @return array{
     *     themes: array<int, array{id: string, name: string, cardIds: array<int, string>}>,
     *     suggestedActions: array<int, array{id: string, content: string, themeId: ?string, status: string, actionItemId: ?string}>
     * }|null
     */
    public function handle(Retro $retro): ?array
    {
        if (! $this->llm->isConfigured()) {
            return null;
        }

        if (! $retro->phase->takesActionItems() && $retro->phase !== RetroPhase::Completed) {
            return null;
        }

        return [
            'themes' => $retro->themes()->with('cards:cards.id')->get()
                ->map(fn (RetroTheme $theme): array => [
                    'id' => $theme->id,
                    'name' => $theme->name,
                    'cardIds' => $theme->cards->pluck('id')->values()->all(),
                ])
                ->values()->all(),
            'suggestedActions' => $retro->suggestedActions()->get()
                ->map(fn (SuggestedAction $suggestion): array => $this->presentSuggestedAction->handle($suggestion))
                ->values()->all(),
        ];
    }
}
