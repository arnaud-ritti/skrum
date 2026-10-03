<?php

use App\Support\Games\CompetitionRanking;

it('ranks the highest first, shares a rank on a tie and skips after it', function () {
    expect(CompetitionRanking::of(['a' => 5, 'b' => 1, 'c' => 3, 'd' => 1, 'e' => 2, 'f' => 0]))
        ->toBe(['a' => 1, 'b' => 4, 'c' => 2, 'd' => 4, 'e' => 3, 'f' => 6]);
});

it('gives no rank to a missing score', function () {
    expect(CompetitionRanking::of(['a' => null, 'b' => 2]))->toBe(['a' => null, 'b' => 1]);
});
