<?php

it('declares the AGPL-3.0-or-later in composer.json, the README and the configuration, beside the verbatim licence text', function () {
    $composer = json_decode((string) file_get_contents(base_path('composer.json')), true, flags: JSON_THROW_ON_ERROR);
    $licence = (string) file_get_contents(base_path('LICENSE'));
    $readme = (string) file_get_contents(base_path('README.md'));

    expect($composer['license'])->toBe('AGPL-3.0-or-later')
        ->and(config('skrum.licence'))->toBe($composer['license'])
        ->and($readme)->toContain('SPDX-License-Identifier: AGPL-3.0-or-later')
        ->and($readme)->toContain("either version 3 of the License, or\n(at your option) any later version.")
        ->and(ltrim($licence))->toStartWith('GNU AFFERO GENERAL PUBLIC LICENSE')
        ->and($licence)->toContain('Version 3, 19 November 2007')
        ->and($licence)->not->toContain('Skrüm')
        ->and($licence)->toContain('END OF TERMS AND CONDITIONS')
        ->and($licence)->not->toContain('MIT License');
});
