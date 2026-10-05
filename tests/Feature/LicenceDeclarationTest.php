<?php

it('declares the AGPL-3.0-or-later in composer.json, the LICENSE file and the configuration alike', function () {
    $composer = json_decode((string) file_get_contents(base_path('composer.json')), true, flags: JSON_THROW_ON_ERROR);
    $licence = (string) file_get_contents(base_path('LICENSE'));

    expect($composer['license'])->toBe('AGPL-3.0-or-later')
        ->and(config('skrum.licence'))->toBe($composer['license'])
        ->and($licence)->toStartWith('Skrüm')
        ->and($licence)->toContain('SPDX-License-Identifier: AGPL-3.0-or-later')
        ->and($licence)->toContain("either version 3 of the License, or\n(at your option) any later version.")
        ->and($licence)->toContain('GNU AFFERO GENERAL PUBLIC LICENSE')
        ->and($licence)->toContain('Version 3, 19 November 2007')
        ->and($licence)->toContain('END OF TERMS AND CONDITIONS')
        ->and($licence)->not->toContain('MIT License');
});
