<?php

namespace App\Console\Commands;

use App\Models\WhiteboardTemplate;
use Database\Seeders\DemoSeeder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

#[Description('Erase the dedicated demo database and recreate its example data')]
#[Signature('skrum:demo-reset')]
class ResetDemoCommand extends Command
{
    public function handle(): int
    {
        if (! config('skrum.demo.enabled')) {
            $this->error('Demo mode is disabled.');

            return self::FAILURE;
        }

        $connection = DB::connection();

        if (basename($connection->getDatabaseName()) !== 'demo.sqlite') {
            $this->error('Demo mode requires a dedicated SQLite database named demo.sqlite.');

            return self::FAILURE;
        }

        $this->call('down');

        Schema::withoutForeignKeyConstraints(function () use ($connection): void {
            $connection->transaction(function () use ($connection): void {
                foreach (Schema::getTableListing() as $table) {
                    if (in_array($table, ['migrations', 'cache_locks'], true)) {
                        continue;
                    }

                    $connection->table($table)->delete();
                }

                if ($this->call('db:seed', ['--database' => $connection->getName(), '--class' => DemoSeeder::class, '--force' => true]) !== self::SUCCESS) {
                    throw new \RuntimeException('Demo reset failed. The application remains in maintenance mode.');
                }
            });
        });

        foreach (['whiteboards', WhiteboardTemplate::StorageRoot] as $directory) {
            Storage::deleteDirectory($directory);
        }

        $this->call('up');
        $this->info('Demo data reset.');

        return self::SUCCESS;
    }
}
