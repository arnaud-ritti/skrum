<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Laravel\Fortify\Features;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->pointLockConnectionAtTheTestDatabase();

        $this->withoutVite();
    }

    /**
     * A parallel run renames the database of the default connection only (<name>_test_<n>).
     * Its twin for cache locks must follow, or every process would take its locks in the same database.
     */
    protected function pointLockConnectionAtTheTestDatabase(): void
    {
        $default = config('database.default');

        if (! config()->has("database.connections.{$default}_locks")) {
            return;
        }

        config([
            "database.connections.{$default}_locks.url" => config("database.connections.{$default}.url"),
            "database.connections.{$default}_locks.database" => config("database.connections.{$default}.database"),
        ]);
    }

    protected function skipUnlessFortifyHas(string $feature, ?string $message = null): void
    {
        if (! Features::enabled($feature)) {
            $this->markTestSkipped($message ?? "Fortify feature [{$feature}] is not enabled.");
        }
    }
}
