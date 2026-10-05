<?php

use App\Enums\WorkspaceRole;
use App\Events\Whiteboards\WhiteboardChanged;
use App\Events\Whiteboards\WhiteboardElementsChanged;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
    Event::fake([WhiteboardElementsChanged::class, WhiteboardChanged::class]);
});

function storedElement(Whiteboard $board, array $data, int $seq): WhiteboardElement
{
    $element = sceneElement($data);

    return WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $element['id'],
        'type' => $element['type'],
        'data' => $element,
        'is_sticky' => isset($element['customData']),
        'is_deleted' => $element['isDeleted'],
        'seq' => $seq,
    ]);
}

it('duplicates a board for any member, who facilitates the copy', function () {
    $source = Whiteboard::factory()->withGuestAccess()->create(['title' => 'Discovery', 'seq' => 4, 'cursors_enabled' => false]);
    whiteboardFacilitator($source);
    [$user] = whiteboardMember($source);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $source->id]);
    Storage::put($file->path, 'image bytes');

    storedElement($source, ['id' => 'note', 'index' => 'a1', 'customData' => ['skrum' => ['kind' => 'sticky']], 'boundElements' => [['id' => 'words', 'type' => 'text']]], 1);
    storedElement($source, ['id' => 'words', 'type' => 'text', 'text' => 'Keep me', 'originalText' => 'Keep me', 'containerId' => 'note', 'index' => 'a2'], 2);
    storedElement($source, ['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a3'], 3);
    storedElement($source, ['id' => 'erased', 'index' => 'a4', 'isDeleted' => true], 4);

    $sourceChangedAt = $source->fresh()->updated_at;

    $response = $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $source))->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();
    $elements = $copy->elements()->orderBy('seq')->get();
    [$note, $words, $photo] = $elements->map(fn (WhiteboardElement $element) => $element->data)->all();

    $response->assertExactJson(['url' => route('whiteboards.show', $copy, absolute: false)]);

    expect($copy->title)->toBe('Discovery (copy)')
        ->and($copy->team_id)->toBe($source->team_id)
        ->and($copy->facilitator->user_id)->toBe($user->id)
        ->and($copy->guest_access_enabled)->toBeFalse()
        ->and($copy->cursors_enabled)->toBeTrue()
        ->and($copy->guest_token)->not->toBe($source->guest_token)
        ->and($copy->seq)->toBe(3)
        ->and($elements)->toHaveCount(3)
        ->and($elements->pluck('author_member_id')->unique()->all())->toBe([$copy->facilitator_member_id])
        ->and($elements->pluck('element_id')->intersect(['note', 'words', 'photo'])->all())->toBeEmpty()
        ->and($elements[0]->is_sticky)->toBeTrue()
        ->and($words['containerId'])->toBe($note['id'])
        ->and($words['text'])->toBe('Keep me')
        ->and($photo['fileId'])->toBe($file->file_id)
        ->and(Storage::get("whiteboards/{$copy->id}/{$file->file_id}"))->toBe('image bytes')
        ->and($source->fresh()->seq)->toBe(4)
        ->and($source->elements()->count())->toBe(4)
        ->and($source->fresh()->updated_at->equalTo($sourceChangedAt))->toBeTrue();

    Event::assertNotDispatched(WhiteboardElementsChanged::class);
    Event::assertNotDispatched(WhiteboardChanged::class);
});

it('keeps the two boards apart afterwards', function () {
    $source = Whiteboard::factory()->create(['seq' => 1]);
    [$user] = whiteboardFacilitator($source);
    storedElement($source, ['id' => 'box', 'x' => 5], 1);

    $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $source))->assertCreated();

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();
    $copied = $copy->elements()->sole();

    $this->actingAs($user)
        ->putJson(route('whiteboards.elements.update', $copy), ['elements' => [[...$copied->data, 'version' => 2, 'x' => 900]]])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $source->delete();

    expect($copy->elements()->sole()->data['x'])->toBe(900)
        ->and(Whiteboard::query()->count())->toBe(1);
});

it('keeps the title of the copy within 120 characters', function () {
    $source = Whiteboard::factory()->create(['title' => str_repeat('a', 120)]);
    [$user] = whiteboardFacilitator($source);

    $this->actingAs($user)->postJson(route('whiteboards.duplicate.store', $source))->assertCreated();

    $title = Whiteboard::query()->whereKeyNot($source->id)->sole()->title;

    expect($title)->toHaveLength(120)
        ->and($title)->toBe(str_repeat('a', 113).' (copy)');
});

it('refuses guests and people outside the team', function () {
    $source = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($source);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->postJson(route('whiteboards.duplicate.store', $source))
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    $outsider = User::factory()->create();
    $source->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($outsider)->postJson(route('whiteboards.duplicate.store', $source))->assertForbidden();

    expect(Whiteboard::query()->count())->toBe(1);
});
