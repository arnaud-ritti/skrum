<?php

use Pest\Rector\Rules\SimplifyToLiteralBooleanRector;
use Pest\Rector\Rules\UseToHaveLengthRector;
use Pest\Rector\Set\PestSetList;
use Rector\CodeQuality\Rector\Identical\FlipTypeControlToUseExclusiveTypeRector;
use Rector\Config\RectorConfig;
use Rector\DeadCode\Rector\Closure\RemoveUnusedClosureVariableUseRector;
use Rector\DeadCode\Rector\If_\RemoveAlwaysTrueIfConditionRector;
use Rector\Php73\Rector\ConstFetch\SensitiveConstantNameRector;
use Rector\Php73\Rector\String_\SensitiveHereNowDocRector;
use Rector\Php81\Rector\Property\ReadOnlyPropertyRector;
use Rector\Php82\Rector\Class_\ReadOnlyClassRector;
use Rector\Php83\Rector\Class_\ReadOnlyAnonymousClassRector;
use Rector\Renaming\Rector\MethodCall\RenameMethodRector;
use Rector\TypeDeclaration\Rector\ArrowFunction\AddArrowFunctionReturnTypeRector;
use Rector\TypeDeclaration\Rector\Closure\AddClosureVoidReturnTypeWhereNoReturnRector;
use Rector\TypeDeclaration\Rector\Closure\ClosureReturnTypeRector;
use Rector\TypeDeclaration\Rector\StmtsAwareInterface\SafeDeclareStrictTypesRector;
use RectorLaravel\Rector\FuncCall\TypeHintTappableCallRector;
use RectorLaravel\Rector\If_\ThrowIfRector;
use RectorLaravel\Rector\StaticCall\CarbonToDateFacadeRector;
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
        SimplifyToLiteralBooleanRector::class => [
            __DIR__.'/tests/Arch/BrowserTestRulesTest.php',
            __DIR__.'/tests/Feature/Database/PortableSchemaTest.php',
            __DIR__.'/tests/Feature/Games/DrawNewWordTest.php',
        ],
        SensitiveConstantNameRector::class,
        SensitiveHereNowDocRector::class,
        TypeHintTappableCallRector::class,
        ClosureReturnTypeRector::class => [
            __DIR__.'/tests/Browser',
        ],
        RemoveAlwaysTrueIfConditionRector::class => [
            __DIR__.'/tests/Support',
        ],
        RemoveUnusedClosureVariableUseRector::class => [
            __DIR__.'/tests/Support',
        ],
        RenameMethodRector::class => [
            __DIR__.'/app/Jobs/Auth/SendMagicLink.php',
        ],
        CarbonToDateFacadeRector::class => [
            __DIR__.'/tests/Unit/Casts/DateOnlyTest.php',
            __DIR__.'/tests/Feature/Database/DateOnlyStorageTest.php',
        ],
        ThrowIfRector::class => [
            __DIR__.'/app/Support/Integrations/GitHub/GitHubAppJwt.php',
        ],
        __DIR__.'/tests/Feature/Retros/RetroBroadcastEventTest.php',
    ]);
