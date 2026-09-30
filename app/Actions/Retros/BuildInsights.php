<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\SuggestedAction;

class BuildInsights
{
    public function __construct(private PresentSuggestedAction $presentSuggestedAction) {}

    /**
     * @return array{
     *     themes: array<int, array{id: string, name: string, cardIds: array<int, string>}>,
     *     suggestedActions: array<int, array{id: string, content: string, themeId: ?string, status: string, actionItemId: ?string}>
     * }|null
     */
    public function handle(Retro $retro): ?array
    {
        if (! in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)) {
            return null;
        }

        return [
            'themes' => $retro->themes()->with('cards:cards.id')->get()
                ->map(fn (RetroTheme $theme) => [
                    'id' => $theme->id,
                    'name' => $theme->name,
                    'cardIds' => $theme->cards->pluck('id')->values()->all(),
                ])
                ->values()->all(),
            'suggestedActions' => $retro->suggestedActions()->get()
                ->map(fn (SuggestedAction $suggestion) => $this->presentSuggestedAction->handle($suggestion))
                ->values()->all(),
        ];
    }
}
