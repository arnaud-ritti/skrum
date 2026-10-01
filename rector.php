<?php

use Pest\Rector\Rules\UseToHaveLengthRector;
use Pest\Rector\Set\PestSetList;
use Rector\CodeQuality\Rector\Identical\FlipTypeControlToUseExclusiveTypeRector;
use Rector\Config\RectorConfig;
use Rector\Php81\Rector\Property\ReadOnlyPropertyRector;
use Rector\Php82\Rector\Class_\ReadOnlyClassRector;
use Rector\Php83\Rector\Class_\ReadOnlyAnonymousClassRector;
use Rector\TypeDeclaration\Rector\ArrowFunction\AddArrowFunctionReturnTypeRector;
use Rector\TypeDeclaration\Rector\Closure\AddClosureVoidReturnTypeWhereNoReturnRector;
use Rector\TypeDeclaration\Rector\StmtsAwareInterface\SafeDeclareStrictTypesRector;
use RectorLaravel\Rector\If_\ThrowIfRector;
use RectorLaravel\Set\LaravelSetList;

return RectorConfig::configure()
    ->withPaths([
        __DIR__.'/app',
        __DIR__.'/bootstrap/app.php',
        __DIR__.'/config',
        __DIR__.'/public/index.php',
        __DIR__.'/routes',
        __DIR__.'/tests',
    ])
    ->withPhpSets()
    ->withComposerBased(laravel: true)
    ->withPreparedSets(
        deadCode: true,
        codeQuality: true,
        typeDeclarations: true,
        earlyReturn: true,
    )
    ->withSets([
        LaravelSetList::LARAVEL_IF_HELPERS,
        LaravelSetList::LARAVEL_TYPE_DECLARATIONS,
        LaravelSetList::LARAVEL_CODE_QUALITY,
        LaravelSetList::LARAVEL_COLLECTION,
        LaravelSetList::LARAVEL_TESTING,
        PestSetList::CODING_STYLE,
    ])
    ->withImportNames(importShortClasses: false)
    ->withSkip([
        FlipTypeControlToUseExclusiveTypeRector::class,
        ReadOnlyPropertyRector::class,
        ReadOnlyClassRector::class,
        ReadOnlyAnonymousClassRector::class,
        SafeDeclareStrictTypesRector::class,
        AddClosureVoidReturnTypeWhereNoReturnRector::class => [
            __DIR__.'/tests',
        ],
        UseToHaveLengthRector::class,
        AddArrowFunctionReturnTypeRector::class => [
            __DIR__.'/tests',
        ],
        ThrowIfRector::class => [
            __DIR__.'/app/Support/Integrations/GitHub/GitHubAppJwt.php',
        ],
        __DIR__.'/tests/Feature/Retros/RetroBroadcastEventTest.php',
    ]);
