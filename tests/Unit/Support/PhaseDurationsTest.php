<?php

use App\Support\Retros\PhaseDurations;

it('keeps the timed phases that have minutes', function () {
    expect(PhaseDurations::normalise(['writing' => 7, 'voting' => 0, 'roti' => 5, 'grouping' => null]))->toBe(['writing' => 7])
        ->and(PhaseDurations::normalise([]))->toBeNull()
        ->and(PhaseDurations::normalise(null))->toBeNull()
        ->and(PhaseDurations::normalise(PhaseDurations::Standard))->toBe(PhaseDurations::Standard);
});
