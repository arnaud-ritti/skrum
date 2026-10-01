<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Jobs\StoreAutomaticWhiteboardVersion;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardVersion;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Queue::fake();
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
    $this->travelTo('2026-10-12 10:00:00');
});

function runAutomaticVersionJob(Whiteboard $board): void
{
    app()->call([new StoreAutomaticWhiteboardVersion($board->id), 'handle']);
}

it('schedules a version five minutes after the first write, and only one', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'first'])])->assertOk();
    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'second'])])->assertOk();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 1);
    Queue::assertPushed(
        StoreAutomaticWhiteboardVersion::class,
        fn (StoreAutomaticWhiteboardVersion $job) => $job->boardId === $board->id
            && $job->delay instanceof DateTimeInterface
            && CarbonImmutable::instance($job->delay)->equalTo(CarbonImmutable::parse('2026-10-12 10:05:00')),
    );
});

it('schedules nothing for a write that changes nothing', function () {
    $board = Whiteboard::factory()->create(['seq' => 1, 'last_versioned_seq' => 1]);
    [$user, $member] = whiteboardMember($board);
    storeWhiteboardElement($board, sceneElement(['id' => 'box', 'version' => 3]), 1, $member);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2])])
        ->assertJsonPath('rejected.0.reason', 'stale');

    Queue::assertNothingPushed();
});

it('stores the live scene and remembers how far it goes', function () {
    $board = Whiteboard::factory()->create(['seq' => 4, 'last_versioned_seq' => 1]);
    [, $member] = whiteboardMember($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    [$note, $text] = stickyWithText('note', 'Idea 7391');
    storeWhiteboardElement($board, [...$note, 'index' => 'a2'], 1, $member);
    storeWhiteboardElement($board, [...$text, 'index' => 'a3'], 2, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a1']), 3, $member);
    storeWhiteboardElement($board, sceneElement(['id' => 'erased', 'index' => 'a4', 'isDeleted' => true]), 4, $member);
    $changedAt = $board->fresh()->updated_at;

    $this->travelTo('2026-10-12 10:05:00');
    runAutomaticVersionJob($board);

    $version = $board->versions()->sole();

    expect($version->name)->toBeNull()
        ->and($version->created_by_member_id)->toBeNull()
        ->and($version->seq)->toBe(4)
        ->and($version->created_at->toDateTimeString())->toBe('2026-10-12 10:05:00')
        ->and(array_column($version->scene['elements'], 'id'))->toBe(['photo', 'note', 'note-text'])
        ->and($version->scene['elements'][2]['text'])->toBe('Idea 7391')
        ->and($version->scene['fileIds'])->toBe([$file->file_id])
        ->and($board->fresh()->last_versioned_seq)->toBe(4)
        ->and($board->fresh()->updated_at->equalTo($changedAt))->toBeTrue();
});

it('stores nothing when nothing changed since the last version, or when the board is gone', function () {
    $board = Whiteboard::factory()->create(['seq' => 3, 'last_versioned_seq' => 3]);

    runAutomaticVersionJob($board);

    expect(WhiteboardVersion::query()->count())->toBe(0);

    $board->delete();
    runAutomaticVersionJob($board);

    expect(WhiteboardVersion::query()->count())->toBe(0);
});

it('stores at most one automatic version every five minutes', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'box'])])->assertOk();

    $this->travelTo('2026-10-12 10:05:00');
    runAutomaticVersionJob($board);

    $this->travelTo('2026-10-12 10:06:00');
    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'box', 'version' => 2])])->assertOk();
    runAutomaticVersionJob($board);

    expect($board->versions()->count())->toBe(1);
    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 2);

    $this->travelTo('2026-10-12 10:11:00');
    runAutomaticVersionJob($board);

    expect($board->versions()->pluck('seq')->sort()->values()->all())->toBe([1, 2])
        ->and($board->fresh()->last_versioned_seq)->toBe(2);
});

it('keeps the last fifty automatic versions and every named one', function () {
    $board = Whiteboard::factory()->create(['seq' => 60, 'last_versioned_seq' => 50]);

    foreach (range(1, 50) as $seq) {
        WhiteboardVersion::factory()->create([
            'whiteboard_id' => $board->id,
            'seq' => $seq,
            'created_at' => now()->subHours(60 - $seq),
        ]);
    }

    $named = WhiteboardVersion::factory()->named('Kick-off')->create([
        'whiteboard_id' => $board->id,
        'seq' => 0,
        'created_at' => now()->subDays(9),
    ]);
    $elsewhere = WhiteboardVersion::factory()->create(['seq' => 1, 'created_at' => now()->subDays(9)]);

    runAutomaticVersionJob($board);

    expect($board->versions()->whereNull('name')->pluck('seq')->sort()->values()->all())->toBe([...range(2, 50), 60])
        ->and($board->versions()->whereKey($named->id)->exists())->toBeTrue()
        ->and($elsewhere->fresh())->not->toBeNull();
});

it('schedules the first version of a board created from a scene', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $board = app(CreateWhiteboard::class)->handle($team, $user, 'From a template', [
        'elements' => [sceneElement(['id' => 'shape'])],
        'files' => [],
    ]);

    putWhiteboardElements($this->actingAs($user), $board, [sceneElement(['id' => 'added', 'index' => 'a5'])])->assertOk();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, fn (StoreAutomaticWhiteboardVersion $job) => $job->boardId === $board->id);
});

it('queues the versions a lost job never stored', function () {
    $stuck = Whiteboard::factory()->create(['seq' => 5, 'last_versioned_seq' => 2]);
    $versioned = Whiteboard::factory()->create(['seq' => 5, 'last_versioned_seq' => 5]);
    $busy = Whiteboard::factory()->create(['seq' => 5, 'last_versioned_seq' => 2]);

    Whiteboard::query()->whereKey([$stuck->id, $versioned->id])->toBase()->update(['updated_at' => now()->subHours(2)]);
    Whiteboard::query()->whereKey($busy->id)->toBase()->update(['updated_at' => now()->subMinutes(10)]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Queue::assertPushed(StoreAutomaticWhiteboardVersion::class, 1);
    Queue::assertPushed(
        StoreAutomaticWhiteboardVersion::class,
        fn (StoreAutomaticWhiteboardVersion $job) => $job->boardId === $stuck->id && $job->delay === null,
    );
});

it('keeps an image for as long as a version shows it', function () {
    $board = Whiteboard::factory()->create();

    $this->travelTo('2026-10-11 08:00:00');
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    $this->travelTo('2026-10-12 10:00:00');

    Storage::put($file->path, 'bytes');

    $version = WhiteboardVersion::factory()->create([
        'whiteboard_id' => $board->id,
        'scene' => [
            'elements' => [sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1]])],
            'fileIds' => [$file->file_id],
        ],
    ]);

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertExists($file->path);
    expect($file->fresh())->not->toBeNull();

    $version->delete();

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertMissing($file->path);
    expect($file->fresh())->toBeNull();
});
