<?php

use App\Support\Integrations\Trackers\TrackerIssue;

it('keeps ten clean labels in the source order', function () {
    $labels = TrackerIssue::labels([' ui ', 'api', 'ui', '', 42, null, str_repeat('x', 70), 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);

    expect($labels)->toBe(['ui', 'api', str_repeat('x', 60), 'a', 'b', 'c', 'd', 'e', 'f', 'g']);
});

it('reads no labels from something that is not a list', function (mixed $value) {
    expect(TrackerIssue::labels($value))->toBe([]);
})->with([[null], ['ui'], [['name' => 'ui']]]);
