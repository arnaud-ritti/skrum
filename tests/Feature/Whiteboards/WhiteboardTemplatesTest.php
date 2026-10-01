<?php

use App\Actions\Whiteboards\WhiteboardTemplateRules;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake();
});

/**
 * A board with a locked frame, a sticky note with its text, a deleted box
 * and one image, written by the facilitator.
 *
 * @return array{0: Whiteboard, 1: User, 2: WhiteboardFile}
 */
function boardWorthSaving(): array
{
    $board = Whiteboard::factory()->create(['seq' => 5]);
    [$user, $member] = whiteboardFacilitator($board);
    $file = WhiteboardFile::factory()->create(['whiteboard_id' => $board->id, 'mime_type' => 'image/png', 'size' => 11]);
    Storage::put($file->path, 'image bytes');

    $elements = [
        sceneElement(['id' => 'zone', 'type' => 'frame', 'name' => 'Zone', 'locked' => true, 'index' => 'a3', 'width' => 400, 'height' => 300]),
        sceneElement(['id' => 'note', 'index' => 'a1', 'frameId' => 'zone', 'backgroundColor' => '#fff3bf', 'customData' => ['skrum' => ['kind' => 'sticky']], 'boundElements' => [['id' => 'words', 'type' => 'text']]]),
        sceneElement(['id' => 'words', 'type' => 'text', 'text' => 'Ship it', 'originalText' => 'Ship it', 'containerId' => 'note', 'index' => 'a2']),
        sceneElement(['id' => 'photo', 'type' => 'image', 'fileId' => $file->file_id, 'status' => 'saved', 'scale' => [1, 1], 'index' => 'a4']),
        sceneElement(['id' => 'erased', 'index' => 'a5', 'isDeleted' => true]),
    ];

    foreach ($elements as $position => $element) {
        WhiteboardElement::factory()->create([
            'whiteboard_id' => $board->id,
            'element_id' => $element['id'],
            'type' => $element['type'],
            'data' => $element,
            'author_member_id' => $member->id,
            'is_sticky' => isset($element['customData']),
            'is_deleted' => $element['isDeleted'],
            'seq' => $position + 1,
        ]);
    }

    return [$board, $user, $file];
}

function saveTemplate(mixed $test, Whiteboard $board, array $body = ['name' => 'Kick-off']): mixed
{
    return $test->postJson(route('whiteboards.template.store', $board), $body);
}

it('saves the live scene of a board, with its images, as a workspace template', function () {
    [$board, $user, $file] = boardWorthSaving();

    saveTemplate($this->actingAs($user), $board, ['name' => 'Kick-off', 'description' => 'How we start a project'])
        ->assertCreated()
        ->assertJsonPath('name', 'Kick-off');

    $template = WhiteboardTemplate::query()->sole();
    $copy = "whiteboard-templates/{$template->id}/{$file->file_id}";

    expect($template->workspace_id)->toBe($board->team->workspace_id)
        ->and($template->description)->toBe('How we start a project')
        ->and($template->created_by_user_id)->toBe($user->id)
        ->and(array_column($template->scene['elements'], 'id'))->toBe(['note', 'words', 'zone', 'photo'])
        ->and($template->scene['elements'][1]['text'])->toBe('Ship it')
        ->and($template->scene['files'])->toBe([['fileId' => $file->file_id, 'path' => $copy, 'mimeType' => 'image/png', 'size' => 11]])
        ->and(Storage::get($copy))->toBe('image bytes')
        ->and(array_column($template->preview['shapes'], 'kind'))->toBe(['rect', 'rect', 'rect'])
        ->and(json_encode($template->scene))->not->toContain($board->facilitator_member_id)
        ->and(json_encode($template->scene))->not->toContain($user->id);
});

it('leaves an image out of the template when its copy fails', function () {
    [$board, $user, $file] = boardWorthSaving();

    Storage::set(config('filesystems.default'), Mockery::mock(Storage::disk())->shouldReceive('copy')->andReturn(false)->getMock());

    saveTemplate($this->actingAs($user), $board)->assertCreated();

    $template = WhiteboardTemplate::query()->sole();

    expect($template->scene['files'])->toBe([]);

    Storage::assertMissing("whiteboard-templates/{$template->id}/{$file->file_id}");
});

it('refuses guests, outsiders and logged-out visitors', function () {
    [$board] = boardWorthSaving();
    $board->update(['guest_access_enabled' => true]);
    $guest = whiteboardGuest($board);

    saveTemplate($this->withCookies(whiteboardGuestCookie($guest))->withCredentials(), $board)
        ->assertForbidden()
        ->assertJsonPath('message', 'Guests cannot do this.');

    $outsider = User::factory()->create();
    $board->team->workspace->members()->attach($outsider, ['role' => WorkspaceRole::Member->value]);

    saveTemplate($this->actingAs($outsider), $board)->assertForbidden();

    expect(WhiteboardTemplate::query()->count())->toBe(0);
});

it('answers a logged-out save with 401', function () {
    saveTemplate($this, Whiteboard::factory()->create())->assertUnauthorized();
});

it('validates the name and the description', function (array $body, string $field) {
    [$board, $user] = boardWorthSaving();

    saveTemplate($this->actingAs($user), $board, $body)->assertJsonValidationErrors($field);

    expect(WhiteboardTemplate::query()->count())->toBe(0);
})->with([
    'no name' => [['name' => ''], 'name'],
    'long name' => [['name' => str_repeat('a', 81)], 'name'],
    'long description' => [['name' => 'Fine', 'description' => str_repeat('a', 301)], 'description'],
]);

it('refuses a name already used in the workspace, whatever its case', function () {
    [$board, $user] = boardWorthSaving();
    WhiteboardTemplate::factory()->create(['workspace_id' => $board->team->workspace_id, 'name' => 'Sprint Map']);
    WhiteboardTemplate::factory()->create(['name' => 'Elsewhere']);

    saveTemplate($this->actingAs($user), $board, ['name' => '  sprint MAP '])
        ->assertUnprocessable()
        ->assertJsonPath('errors.name.0', 'A template with this name already exists.');

    saveTemplate($this->actingAs($user), $board, ['name' => 'Elsewhere'])->assertCreated();
});

it('keeps the name unique in the database too', function () {
    $workspace = Workspace::factory()->create();
    WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Sprint Map']);

    expect(fn () => WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'sprint map']))
        ->toThrow(QueryException::class);
});

it('stops at fifty templates per workspace', function () {
    [$board, $user] = boardWorthSaving();
    WhiteboardTemplate::factory()->count(WhiteboardTemplateRules::MaxTemplates)->create(['workspace_id' => $board->team->workspace_id]);

    saveTemplate($this->actingAs($user), $board)
        ->assertUnprocessable()
        ->assertJsonPath('errors.name.0', 'This workspace already has 50 whiteboard templates.');

    expect(WhiteboardTemplate::query()->count())->toBe(50);
});

it('lets another member create a board from the template, on its own from then on', function () {
    [$source, $user, $file] = boardWorthSaving();
    saveTemplate($this->actingAs($user), $source)->assertCreated();
    $template = WhiteboardTemplate::query()->sole();

    $team = Team::factory()->create(['workspace_id' => $source->team->workspace_id]);
    $other = teamMember($team);

    $this->actingAs($other)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'From template', 'workspace_template_id' => $template->id])
        ->assertRedirect();

    $board = Whiteboard::query()->whereKeyNot($source->id)->sole();
    $elements = $board->elements()->orderBy('seq')->get();
    [$note, $words, $zone, $photo] = $elements->map(fn (WhiteboardElement $element) => $element->data)->all();

    expect($board->team_id)->toBe($team->id)
        ->and($board->facilitator->user_id)->toBe($other->id)
        ->and($elements)->toHaveCount(4)
        ->and($elements->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($elements->pluck('element_id')->intersect(['note', 'words', 'zone', 'photo'])->all())->toBe([])
        ->and($note['customData'])->toBe(['skrum' => ['kind' => 'sticky']])
        ->and($note['frameId'])->toBe($zone['id'])
        ->and($words['containerId'])->toBe($note['id'])
        ->and($words['text'])->toBe('Ship it')
        ->and($zone['locked'])->toBeTrue()
        ->and($photo['fileId'])->toBe($file->file_id)
        ->and($board->files()->sole()->path)->toBe("whiteboards/{$board->id}/{$file->file_id}");

    $this->actingAs($other)->get(route('whiteboards.files.show', [$board, $file->file_id]))->assertOk();

    $this->actingAs($other)
        ->putJson(route('whiteboards.elements.update', $board), ['elements' => [[...$words, 'version' => 2, 'text' => 'Changed', 'originalText' => 'Changed']]])
        ->assertOk()
        ->assertJsonPath('rejected', []);

    $template->delete();
    $source->delete();

    expect($template->scene['elements'][1]['text'])->toBe('Ship it');
    Storage::assertExists("whiteboards/{$board->id}/{$file->file_id}");
    Storage::assertMissing("whiteboard-templates/{$template->id}/{$file->file_id}");
});

it('refuses a template of another workspace, an unknown one, and two templates at once', function (string $case) {
    $team = Team::factory()->create();
    $own = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id]);
    $foreign = WhiteboardTemplate::factory()->create();

    $body = match ($case) {
        'another workspace' => ['workspace_template_id' => $foreign->id],
        'unknown' => ['workspace_template_id' => '00000000-0000-0000-0000-000000000000'],
        'not a uuid' => ['workspace_template_id' => 'swot'],
        'both' => ['workspace_template_id' => $own->id, 'template' => 'swot'],
    };

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Nope', ...$body])
        ->assertSessionHasErrors('workspace_template_id');

    expect(Whiteboard::query()->count())->toBe(0);
})->with(['another workspace', 'unknown', 'not a uuid', 'both']);

it('never lets a guest create a board from a template', function () {
    $board = Whiteboard::factory()->withGuestAccess()->create();
    $guest = whiteboardGuest($board);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $board->team->workspace_id]);

    $this->withCookies(whiteboardGuestCookie($guest))->withCredentials()
        ->post(route('teams.whiteboards.store', [$board->team->workspace, $board->team]), ['title' => 'Guest', 'workspace_template_id' => $template->id])
        ->assertRedirect(route('login'));

    expect(Whiteboard::query()->count())->toBe(1);
});

it('lets the creator and a workspace admin rename and describe a template', function () {
    $workspace = Workspace::factory()->create();
    $creator = workspaceManager($workspace, WorkspaceRole::Member);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Draft', 'created_by_user_id' => $creator->id]);

    $this->actingAs($creator)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'Final', 'description' => 'Ready'])
        ->assertRedirect();

    expect($template->fresh()->name)->toBe('Final')
        ->and($template->fresh()->description)->toBe('Ready');

    $this->actingAs(workspaceManager($workspace))
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['description' => ''])
        ->assertRedirect();

    expect($template->fresh()->name)->toBe('Final')
        ->and($template->fresh()->description)->toBeNull();
});

it('keeps names unique when renaming, but lets a template keep its own', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Taken']);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Mine']);

    $this->actingAs($admin)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'TAKEN'])
        ->assertSessionHasErrors(['name' => 'A template with this name already exists.']);

    $this->actingAs($admin)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'MINE'])
        ->assertSessionHasNoErrors();

    expect($template->fresh()->name)->toBe('MINE');
});

it('refuses other members and other workspaces', function () {
    $workspace = Workspace::factory()->create();
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Kept']);
    $member = workspaceManager($workspace, WorkspaceRole::Member);
    $formerCreator = $template->created_by_user_id;

    $this->actingAs($member)
        ->patch(route('workspaces.whiteboardTemplates.update', [$workspace, $template]), ['name' => 'Stolen'])
        ->assertForbidden();
    $this->actingAs($member)
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$workspace, $template]))
        ->assertForbidden();
    $this->actingAs(User::query()->findOrFail($formerCreator))
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$workspace, $template]))
        ->assertForbidden();

    $elsewhere = Workspace::factory()->create();

    $this->actingAs(workspaceManager($elsewhere))
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$elsewhere, $template]))
        ->assertNotFound();

    expect($template->fresh()->name)->toBe('Kept');
});

it('deletes a template with its images', function () {
    $workspace = Workspace::factory()->create();
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $workspace->id]);
    Storage::put("whiteboard-templates/{$template->id}/abc", 'bytes');

    $this->actingAs(workspaceManager($workspace))
        ->delete(route('workspaces.whiteboardTemplates.destroy', [$workspace, $template]))
        ->assertRedirect();

    expect(WhiteboardTemplate::query()->count())->toBe(0);
    Storage::assertMissing("whiteboard-templates/{$template->id}/abc");
});

it('prunes the folder of a template that is gone, once its files are a day old', function () {
    $template = WhiteboardTemplate::factory()->create();
    $kept = "whiteboard-templates/{$template->id}/abc";
    $old = 'whiteboard-templates/00000000-0000-0000-0000-000000000001/abc';
    $recent = 'whiteboard-templates/00000000-0000-0000-0000-000000000002/abc';

    foreach ([$kept, $old, $recent] as $path) {
        Storage::put($path, 'bytes');
    }

    touch(Storage::path($kept), now()->subDays(2)->getTimestamp());
    touch(Storage::path($old), now()->subDays(2)->getTimestamp());

    $this->artisan('skrum:prune-whiteboards')->assertSuccessful();

    Storage::assertExists($kept);
    Storage::assertMissing($old);
    Storage::assertExists($recent);
});
