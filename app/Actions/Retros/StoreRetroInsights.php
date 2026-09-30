<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Enums\SuggestedActionStatus;
use App\Enums\SummaryStatus;
use App\Events\Retros\InsightsChanged;
use App\Events\Retros\ResultsChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\DB;

class StoreRetroInsights
{
    public function __construct(private ClearRetroInsights $clearRetroInsights) {}

    public function handle(Retro $retro, SummaryOutput $output): void
    {
        DB::transaction(function () use ($retro, $output): void {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            if ($locked->phase !== RetroPhase::Completed) {
                $this->clearRetroInsights->abandon($locked);

                return;
            }

            $this->clearRetroInsights->clear($locked);

            $locked->update([
                'summary' => $output->summary,
                'summary_generated_at' => now(),
                'summary_status' => SummaryStatus::Ready,
            ]);

            $themeIds = $this->storeThemes($locked, $output);
            $this->storeSuggestedActions($locked, $output, $themeIds);

            foreach ($output->cardInsights as $cardId => $insight) {
                $locked->cards()->whereKey($cardId)->update([
                    'sentiment' => $insight['sentiment']?->value,
                    'category' => $insight['category'],
                ]);
            }

            (new ResultsChanged($locked->id))->sendToOthers();
            (new InsightsChanged($locked->id))->sendToOthers();
        });
    }

    /**
     * @return array<string, string> lower-cased theme name => theme id
     */
    private function storeThemes(Retro $locked, SummaryOutput $output): array
    {
        $themeIds = [];

        foreach ($output->themes as $position => $theme) {
            $created = $locked->themes()->create(['name' => $theme['name'], 'position' => $position]);
            $created->cards()->attach($theme['cardIds']);
            $themeIds[mb_strtolower($theme['name'])] = $created->id;
        }

        return $themeIds;
    }

    /**
     * @param  array<string, string>  $themeIds
     */
    private function storeSuggestedActions(Retro $locked, SummaryOutput $output, array $themeIds): void
    {
        $handledWordings = $locked->suggestedActions()
            ->where('status', '!=', SuggestedActionStatus::Pending)
            ->pluck('content')
            ->map(fn (string $content) => mb_strtolower(trim($content)))
            ->all();
        $position = (int) $locked->suggestedActions()->max('position') + 1;

        foreach ($output->suggestedActions as $suggestion) {
            if (in_array(mb_strtolower($suggestion['content']), $handledWordings, true)) {
                continue;
            }

            $locked->suggestedActions()->create([
                'content' => $suggestion['content'],
                'theme_id' => $suggestion['theme'] === null ? null : ($themeIds[mb_strtolower($suggestion['theme'])] ?? null),
                'position' => $position++,
                'status' => SuggestedActionStatus::Pending,
            ]);
        }
    }
}
