<?php

use Pest\Rector\Rules\UseToHaveLengthRector;
use Pest\Rector\Set\PestSetList;
use Rector\CodeQuality\Rector\Identical\FlipTypeControlToUseExclusiveTypeRector;
use Rector\Config\RectorConfig;
use Rector\DeadCode\Rector\If_\RemoveAlwaysTrueIfConditionRector;
use Rector\Php73\Rector\ConstFetch\SensitiveConstantNameRector;
use Rector\Php81\Rector\Property\ReadOnlyPropertyRector;
use Rector\Php82\Rector\Class_\ReadOnlyClassRector;
use Rector\Php83\Rector\Class_\ReadOnlyAnonymousClassRector;
use Rector\Renaming\Rector\MethodCall\RenameMethodRector;
use Rector\TypeDeclaration\Rector\ArrowFunction\AddArrowFunctionReturnTypeRector;
use Rector\TypeDeclaration\Rector\Closure\AddClosureVoidReturnTypeWhereNoReturnRector;
use Rector\TypeDeclaration\Rector\Closure\ClosureReturnTypeRector;
use Rector\TypeDeclaration\Rector\StmtsAwareInterface\SafeDeclareStrictTypesRector;
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
        // Trusts PHPDoc types (model @property): `instanceof CarbonImmutable` would flip a branch on a mutable Carbon.
        FlipTypeControlToUseExclusiveTypeRector::class,
        // Spatie guideline: no readonly by default.
        ReadOnlyPropertyRector::class,
        ReadOnlyClassRector::class,
        ReadOnlyAnonymousClassRector::class,
        // Laravel convention: no strict_types; adding it to 350 files would change scalar coercion at runtime.
        SafeDeclareStrictTypesRector::class,
        // Pest convention: test closures stay untyped.
        AddClosureVoidReturnTypeWhereNoReturnRector::class => [
            __DIR__.'/tests',
        ],
        AddArrowFunctionReturnTypeRector::class => [
            __DIR__.'/tests',
        ],
        // toHaveLength counts characters; these assertions check byte lengths.
        UseToHaveLengthRector::class => [
            __DIR__.'/tests/Feature/Integrations/WebhookClientTest.php',
        ],
        // PHP 7.3 rule, moot on PHP 8; it uppercases the PascalCase test constants into undefined ones.
        SensitiveConstantNameRector::class,
        // Browser pages proxy Webpage through __call and return AwaitableWebpage, so the inferred `: Webpage` fails at runtime.
        ClosureReturnTypeRector::class => [
            __DIR__.'/tests/Browser',
        ],
        // $hidden is captured by reference and turned off later; the condition is not always true.
        RemoveAlwaysTrueIfConditionRector::class => [
            __DIR__.'/tests/Support/MissingTables.php',
        ],
        // Laravel 8 sendNow → send rename is obsolete; the job sends the queued mailable synchronously on purpose.
        RenameMethodRector::class => [
            __DIR__.'/app/Jobs/Auth/SendMagicLink.php',
        ],
        // Date resolves to CarbonImmutable here; these tests need the mutable Carbon.
        CarbonToDateFacadeRector::class => [
            __DIR__.'/tests/Unit/Casts/DateOnlyTest.php',
            __DIR__.'/tests/Feature/Database/DateOnlyStorageTest.php',
        ],
    ]);
