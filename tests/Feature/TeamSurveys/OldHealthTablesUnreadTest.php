<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Finder\SplFileInfo;

it('reads and writes the old health tables nowhere but in the import and its verification', function () {
    $allowed = ['Support/Surveys/ImportHealthChecks.php', 'Support/Surveys/VerifyHealthCheckImport.php'];

    $offenders = collect(File::allFiles(app_path()))
        ->reject(fn (SplFileInfo $file): bool => in_array($file->getRelativePathname(), $allowed, true))
        ->filter(fn (SplFileInfo $file): bool => preg_match('/health_check_answers|retro_health_statements|\bHealthCheckAnswer\b|\bRetroHealthStatement\b|FreezeHealthStatements|healthCheckAnswers\(/', $file->getContents()) === 1)
        ->map(fn (SplFileInfo $file): string => $file->getRelativePathname())
        ->values()
        ->all();

    expect($offenders)->toBeEmpty();
});

it('keeps the old tables and the old column until a later release drops them', function () {
    expect(Schema::hasTable('health_check_answers'))->toBeTrue()
        ->and(Schema::hasTable('retro_health_statements'))->toBeTrue()
        ->and(Schema::hasColumn('retros', 'health_check_enabled'))->toBeTrue();
});
