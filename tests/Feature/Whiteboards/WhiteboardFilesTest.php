<?php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\SqlProbe;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class]);
});

function uploadBoardFile(mixed $test, Whiteboard $board, UploadedFile $file, string $fileId = 'abc123'): mixed
{
    return $test->post(route('whiteboards.files.store', $board), ['file' => $file, 'file_id' => $fileId], ['Accept' => 'application/json']);
}

it('stores an image and serves it back to members', function () {
    $board = Whiteboard::factory()->create();
    [$user, $member] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('photo.png', 20, 20))
        ->assertCreated()
        ->assertJsonPath('id', 'abc123')
        ->assertJsonPath('mimeType', 'image/png')
        ->assertJsonPath('url', route('whiteboards.files.show', [$board, 'abc123'], absolute: false));

    $file = WhiteboardFile::query()->sole();

    expect($file->uploaded_by_member_id)->toBe($member->id)
        ->and($file->path)->toBe("whiteboards/{$board->id}/abc123");
    Storage::assertExists($file->path);

    $this->actingAs($user)
        ->get(route('whiteboards.files.show', [$board, 'abc123']))
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

it('answers an upload that already exists without storing it twice', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertCreated();
    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertOk();

    expect(WhiteboardFile::query()->count())->toBe(1);
});

it('looks for an upload that already exists under the board lock', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertCreated();
    $levelOutside = DB::transactionLevel();

    $locks = SqlProbe::locks(fn () => uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertOk());

    expect($locks)->toBe([['table' => 'whiteboards', 'level' => $levelOutside + 1]])
        ->and(WhiteboardFile::query()->count())->toBe(1);
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('refuses what is not a png, jpeg, webp or gif, whatever its name says', function (UploadedFile $file) {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, $file)->assertJsonValidationErrors('file');

    expect(WhiteboardFile::query()->count())->toBe(0);
})->with([
    'svg' => [fn () => UploadedFile::fake()->createWithContent('drawing.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')],
    'svg named png' => [fn () => UploadedFile::fake()->createWithContent('drawing.png', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    'html named png' => [fn () => UploadedFile::fake()->createWithContent('page.png', '<html><script>alert(1)</script></html>')],
    'pdf' => [fn () => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf')],
]);

it('refuses files over 5 MB and boards over 100 MB', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('big.png')->size(5121))
        ->assertJsonValidationErrors('file');

    WhiteboardFile::factory()->create(['whiteboard_id' => $board->id, 'size' => Whiteboard::MaxStorageBytes - 100]);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('small.png')->size(1))
        ->assertJsonValidationErrors('file')
        ->assertJsonPath('errors.file.0', 'This board has reached its image storage limit.');
});

it('refuses a malformed file id', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);

    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'), '../../etc/passwd')
        ->assertJsonValidationErrors('file_id');
});

it('never serves a file to someone outside the board', function () {
    $board = Whiteboard::factory()->create();
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);
    Storage::put($file->path, 'bytes');

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->get(route('whiteboards.files.show', [$board, $file->file_id]))->assertForbidden();

    auth()->logout();

    $this->getJson(route('whiteboards.files.show', [$board, $file->file_id]))->assertUnauthorized();
});

it('does not serve the file of another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $foreign = WhiteboardFile::factory()->create();
    Storage::put($foreign->path, 'bytes');

    $this->actingAs($user)->get(route('whiteboards.files.show', [$board, $foreign->file_id]))->assertNotFound();
});

it('rejects an image element whose file is unknown or belongs to another board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardMember($board);
    $foreign = WhiteboardFile::factory()->create();
    $own = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id]);

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [
            sceneElement(['id' => 'ghost', 'type' => 'image', 'fileId' => 'missing']),
            sceneElement(['id' => 'stolen', 'type' => 'image', 'fileId' => $foreign->file_id]),
            sceneElement(['id' => 'fine', 'type' => 'image', 'fileId' => $own->file_id]),
        ]])
        ->assertOk()
        ->assertJsonCount(2, 'rejected')
        ->assertJsonPath('rejected.0', ['id' => 'ghost', 'reason' => 'file', 'element' => null])
        ->assertJsonPath('rejected.1.id', 'stolen');

    expect($board->elements()->pluck('element_id')->all())->toBe(['fine']);
});

it('removes the stored images with the board', function () {
    $board = Whiteboard::factory()->create();
    [$user] = whiteboardFacilitator($board);
    uploadBoardFile($this->actingAs($user), $board, UploadedFile::fake()->image('a.png'))->assertCreated();

    $this->actingAs($user)->deleteJson(route('whiteboards.destroy', $board))->assertNoContent();

    Storage::assertMissing("whiteboards/{$board->id}/abc123");
});
