<?php

use App\Models\Card;
use App\Models\Retro;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

it('refuses to erase data when demo mode is disabled', function () {
    $user = User::factory()->create();

    $this->artisan('skrum:demo-reset')->assertFailed();

    expect($user->fresh())->not->toBeNull();
});

it('refuses to reset a database that is not dedicated to the demo', function () {
    config(['skrum.demo.enabled' => true]);
    $user = User::factory()->create();

    $this->artisan('skrum:demo-reset')->assertFailed();

    expect($user->fresh())->not->toBeNull();
});

it('restores exactly two non-admin accounts and sample cards and removes visitor data and files', function () {
    Storage::fake();
    Storage::put('whiteboards/visitor/image.png', 'image');
    $originalConnection = config('database.default');
    $directory = sys_get_temp_dir().'/skrum-demo-'.bin2hex(random_bytes(8));
    File::makeDirectory($directory);
    File::put($directory.'/demo.sqlite', '');
    config([
        'skrum.demo.enabled' => true,
        'database.connections.demo_test' => [
            ...config('database.connections.sqlite'),
            'database' => $directory.'/demo.sqlite',
            'url' => null,
        ],
        'database.default' => 'demo_test',
    ]);

    try {
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $this->seed(DemoSeeder::class);
        $originalRetroId = Retro::firstOrFail()->id;
        $visitor = User::factory()->create();
        DB::table('sessions')->insert([
            'id' => 'visitor-session', 'user_id' => $visitor->id,
            'payload' => '', 'last_activity' => time(),
        ]);

        $this->artisan('skrum:demo-reset')->assertSuccessful();
        $this->artisan('skrum:demo-reset')->assertSuccessful();

        expect(User::orderBy('email')->pluck('email')->all())->toBe([
            'facilitator@skrum.test', 'member@skrum.test',
        ])
            ->and(User::where('is_instance_admin', true)->count())->toBe(0)
            ->and(User::find($visitor->id))->toBeNull()
            ->and(Retro::find($originalRetroId))->toBeNull()
            ->and(Retro::count())->toBe(1)
            ->and(Card::count())->toBe(3)
            ->and(DB::table('sessions')->count())->toBe(0);
        Storage::assertMissing('whiteboards/visitor/image.png');
    } finally {
        $this->artisan('up');
        DB::purge('demo_test');
        config(['database.default' => $originalConnection]);
        File::deleteDirectory($directory);
    }
});
