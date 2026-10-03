<?php

it('declares the AGPL-3.0 in composer.json, the LICENSE file and the configuration alike', function () {
    $composer = json_decode((string) file_get_contents(base_path('composer.json')), true, flags: JSON_THROW_ON_ERROR);
    $licence = (string) file_get_contents(base_path('LICENSE'));

    expect($composer['license'])->toBe('AGPL-3.0-only')
        ->and(config('skrum.licence'))->toBe('AGPL-3.0')
        ->and(str_starts_with($composer['license'], config('skrum.licence')))->toBeTrue()
        ->and($licence)->toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
        ->and($licence)->toContain('Version 3, 19 November 2007')
        ->and($licence)->toContain('END OF TERMS AND CONDITIONS')
        ->and($licence)->not->toContain('MIT License');
});
