<?php

namespace App\Actions\Retros;

use App\Models\Retro;
use App\Support\Llm\Llm;

class PresentRetroSummary
{
    public function __construct(private Llm $llm) {}

    /**
     * @return array{
     *     text: ?string,
     *     generatedAt: ?string,
     *     status: ?string,
     *     provider: string
     * }|null
     */
    public function handle(Retro $retro): ?array
    {
        $provider = $this->llm->providerName();

        if ($provider === null) {
            return null;
        }

        return [
            'text' => $retro->summary,
            'generatedAt' => $retro->summary_generated_at?->toIso8601String(),
            'status' => $retro->effectiveSummaryStatus()?->value,
            'provider' => $provider,
        ];
    }
}
