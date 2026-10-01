<?php

use App\Actions\Whiteboards\CreateWhiteboard;
use App\Actions\Whiteboards\DuplicateWhiteboard;
use App\Actions\Whiteboards\SaveWhiteboardTemplate;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardFile;
use App\Models\WhiteboardMember;
use App\Models\WhiteboardTemplate;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

const P17bFileId = 'p17bImage0001';

function p17bTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     board: Whiteboard,
 *     team: Team,
 *     fran: User,
 *     franMember: WhiteboardMember
 * }
 */
function p17bBoard(array $attributes = []): array
{
    $board = Whiteboard::factory()->create(['title' => 'Sprint board', ...$attributes]);
    [$fran, $franMember] = whiteboardFacilitator($board);

    return [
        'board' => $board,
        'team' => $board->team,
        'fran' => renamedWhiteboardUser($fran, 'Fran Facilitator'),
        'franMember' => $franMember,
    ];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function p17bStored(Whiteboard $board, WhiteboardMember $author, array $overrides, int $seq): array
{
    $data = sceneElement($overrides);

    WhiteboardElement::factory()->create([
        'whiteboard_id' => $board->id,
        'element_id' => $data['id'],
        'type' => $data['type'],
        'data' => $data,
        'version' => $data['version'],
        'version_nonce' => $data['versionNonce'],
        'author_member_id' => $author->id,
        'is_sticky' => isset($data['customData']),
        'seq' => $seq,
    ]);

    Whiteboard::query()->whereKey($board->id)->update(['seq' => $seq]);

    return $data;
}

function p17bScene(Whiteboard $board, WhiteboardMember $author): void
{
    $path = "{$board->storageDirectory()}/".P17bFileId;
    $bytes = base64_decode(WhiteboardPng);

    Storage::put($path, $bytes);
    WhiteboardFile::factory()->create([
        'whiteboard_id' => $board->id,
        'file_id' => P17bFileId,
        'path' => $path,
        'mime_type' => 'image/png',
        'size' => strlen($bytes),
    ]);

    p17bStored($board, $author, [
        'id' => 'p17bSticky',
        'index' => 'a0',
        'x' => 100,
        'y' => 100,
        'width' => 200,
        'height' => 200,
        'backgroundColor' => '#fff3bf',
        'roughness' => 0,
        'versionNonce' => 101,
        'customData' => ['skrum' => ['kind' => 'sticky']],
    ], 1);
    p17bStored($board, $author, [
        'id' => 'p17bShape',
        'index' => 'a1',
        'x' => 400,
        'y' => 120,
        'width' => 160,
        'height' => 100,
        'versionNonce' => 102,
        'boundElements' => [['id' => 'p17bArrow', 'type' => 'arrow']],
    ], 2);
    p17bStored($board, $author, [
        'id' => 'p17bArrow',
        'type' => 'arrow',
        'index' => 'a2',
        'x' => 564,
        'y' => 170,
        'width' => 150,
        'height' => 0,
        'versionNonce' => 103,
        'points' => [[0, 0], [150, 0]],
        'lastCommittedPoint' => null,
        'startBinding' => ['elementId' => 'p17bShape', 'focus' => 0, 'gap' => 4],
        'endBinding' => null,
        'startArrowhead' => null,
        'endArrowhead' => 'arrow',
        'elbowed' => false,
    ], 3);
    p17bStored($board, $author, [
        'id' => 'p17bImage',
        'type' => 'image',
        'index' => 'a3',
        'x' => 100,
        'y' => 400,
        'width' => 120,
        'height' => 120,
        'strokeColor' => 'transparent',
        'versionNonce' => 104,
        'fileId' => P17bFileId,
        'status' => 'saved',
        'scale' => [1, 1],
        'crop' => null,
    ], 4);
}

function p17bTile(string $name): string
{
    return "[role=\"dialog\"] [role=\"radio\"]:has(span:text-is(\"{$name}\"))";
}

function p17bCreateBoard(mixed $page, string $tileName, string $title, string $newLabel = 'New whiteboard', string $createLabel = 'Create'): Whiteboard
{
    $page->click("button:text-is(\"{$newLabel}\")")
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->click(p17bTile($tileName))
        ->assertAriaAttribute(p17bTile($tileName), 'checked', 'true')
        ->fill('#whiteboard-title', $title)
        ->click("[role=\"dialog\"] form button:text-is(\"{$createLabel}\")")
        ->assertPathBeginsWith('/whiteboards/');

    return Whiteboard::query()->where('title', $title)->sole();
}

/**
 * @param  array<int, array<string, mixed>>  $elements
 * @return array<int, string>
 */
function p17bLabelsOutside(array $elements): array
{
    $byId = collect($elements)->keyBy('id');

    return collect($elements)
        ->filter(fn (array $element): bool => $element['type'] === 'text' && ($element['containerId'] ?? null) !== null)
        ->filter(fn (array $text): bool => $byId[$text['containerId']]['type'] !== 'arrow')
        ->reject(function (array $text) use ($byId): bool {
            $shape = $byId[$text['containerId']];

            return $text['x'] >= $shape['x']
                && $text['y'] >= $shape['y']
                && $text['x'] + $text['width'] <= $shape['x'] + $shape['width']
                && $text['y'] + $text['height'] <= $shape['y'] + $shape['height'];
        })
        ->pluck('text')
        ->values()
        ->all();
}

function p17bTemplateRow(string $name): string
{
    return "[role=\"dialog\"] li:has(p:text-is(\"{$name}\"))";
}

function p17bFileDownload(Whiteboard $board): string
{
    $path = "/whiteboards/{$board->id}/files/".P17bFileId;

    return "() => fetch('{$path}').then((response) => response.blob().then((blob) => response.status + ' ' + blob.type + ' ' + blob.size))";
}

function p17bRecordDownloads(mixed $page): void
{
    $page->script(<<<'JS'
        () => {
            const create = URL.createObjectURL.bind(URL);
            const click = HTMLAnchorElement.prototype.click;

            window.p17bDownloads = { names: [], blobs: [] };

            URL.createObjectURL = (blob) => {
                window.p17bDownloads.blobs.push(blob);

                return create(blob);
            };

            window.showSaveFilePicker = (options) => {
                window.p17bDownloads.names.push(options?.suggestedName ?? '');

                return Promise.reject(new DOMException('The user aborted a request.', 'AbortError'));
            };

            HTMLAnchorElement.prototype.click = function () {
                if (this.hasAttribute('download')) {
                    window.p17bDownloads.names.push(this.download);

                    return undefined;
                }

                return click.call(this);
            };

            return true;
        }
        JS);
}

/**
 * @param  array<int, array<string, mixed>>  $elements
 * @return array<int, string>
 */
function p17bShapes(array $elements): array
{
    return collect($elements)
        ->map(fn (array $element): string => "{$element['type']}:{$element['x']}:{$element['y']}:{$element['width']}:{$element['height']}")
        ->sort()
        ->values()
        ->all();
}

function p17bSnapshotRequests(): string
{
    return "performance.getEntriesByType('resource').filter((entry) => new URL(entry.name).pathname.endsWith('/snapshot') && entry.initiatorType === 'xmlhttprequest' && entry.responseEnd > 0).length";
}

it('[P17b-01a] offers eight built-in templates with Blank first and selected, each with a thumbnail, a name and a description, and lists a workspace template apart', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off map',
        'description' => 'How we start a project',
        'preview' => ['width' => 200, 'height' => 100, 'shapes' => [
            ['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 200, 'height' => 100, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []],
        ]],
        'created_by_user_id' => $fran->id,
    ]);
    $builtIns = "document.querySelectorAll('[role=\"dialog\"] [role=\"radiogroup\"]')[0]";

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] #whiteboard-title')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertScript("Array.from({$builtIns}.querySelectorAll('[role=\"radio\"] span.font-medium')).map((name) => name.textContent).join('|')", 'Blank|Brainstorm|Flowchart|User story map|Impact map|SWOT|Lean canvas|2×2 matrix')
        ->assertScript("{$builtIns}.querySelectorAll('[role=\"radio\"] svg').length", 8)
        ->assertScript("Array.from({$builtIns}.querySelectorAll('[role=\"radio\"]')).filter((tile) => tile.querySelector('span.text-muted-foreground')?.textContent.trim().length > 0).length", 8)
        ->assertAriaAttribute(p17bTile('Blank'), 'checked', 'true')
        ->assertCount('[role="dialog"] [role="radio"][aria-checked="true"]', 1)
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertCount('[role="dialog"] [role="radiogroup"]', 2)
        ->assertPresent('[role="dialog"] [role="radiogroup"] >> nth=1 >> [role="radio"]:has(span:text-is("Kick-off map"))')
        ->assertSeeIn(p17bTile('Kick-off map'), 'How we start a project')
        ->assertCount(p17bTile('Kick-off map').' svg rect[stroke="#1e1e1e"]', 1);
});

it('[P17b-02] creates a board from each of the eight built-in templates, with its creator as facilitator, its structure locked and its sample notes free', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    $templates = [
        'Blank' => ['key' => 'blank', 'frames' => 0, 'locked' => 0, 'stickies' => 0],
        'Brainstorm' => ['key' => 'brainstorm', 'frames' => 3, 'locked' => 3, 'stickies' => 3],
        'Flowchart' => ['key' => 'flowchart', 'frames' => 1, 'locked' => 7, 'stickies' => 0],
        'User story map' => ['key' => 'user_story_map', 'frames' => 3, 'locked' => 3, 'stickies' => 3],
        'Impact map' => ['key' => 'impact_map', 'frames' => 4, 'locked' => 4, 'stickies' => 4],
        'SWOT' => ['key' => 'swot', 'frames' => 4, 'locked' => 4, 'stickies' => 4],
        'Lean canvas' => ['key' => 'lean_canvas', 'frames' => 9, 'locked' => 9, 'stickies' => 1],
        '2×2 matrix' => ['key' => 'matrix', 'frames' => 4, 'locked' => 8, 'stickies' => 1],
    ];

    $page = $this->signIn($fran, p17bTeamPath($team));

    foreach ($templates as $tile => $expected) {
        $board = p17bCreateBoard($page, $tile, "Board from {$expected['key']}");

        $this->awaitRealtime($page);

        $snapshot = $this->whiteboardSnapshot($page, $board);
        $elements = collect($snapshot['elements']);
        $stickies = $elements->filter(fn (array $element): bool => isset($element['customData']));

        expect($snapshot['me']['isFacilitator'])->toBeTrue()
            ->and($snapshot['me']['name'])->toBe('Fran Facilitator')
            ->and($elements)->toHaveSameSize(resolve(BuiltInTemplates::class)->elements($expected['key']))
            ->and($elements->where('type', 'frame'))->toHaveCount($expected['frames'])
            ->and($elements->where('type', 'frame')->where('locked', false))->toBeEmpty()
            ->and($elements->where('locked', true))->toHaveCount($expected['locked'])
            ->and($stickies)->toHaveCount($expected['stickies'])
            ->and($stickies->where('locked', true))->toBeEmpty()
            ->and($board->facilitator->user_id)->toBe($fran->id);

        $this->awaitWhiteboardElements($page, $elements->count());

        $page->assertSeeIn('header > h1', "Board from {$expected['key']}")
            ->navigate(p17bTeamPath($team))
            ->assertPresent("a[href=\"/whiteboards/{$board->id}\"]");
    }

    expect(Whiteboard::query()->where('team_id', $team->id)->count())->toBe(8);
});

it('[P17b-03] leaves a locked frame where it is when it is dragged and deleted on the canvas, and moves and deletes a sample note', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');

    $page = $this->signIn($fran, p17bTeamPath($team));
    $board = p17bCreateBoard($page, 'SWOT', 'Locked structure');

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 12);
    $this->awaitWhiteboardScene($page, $board);

    $elements = collect($this->whiteboardElements($page, $board));
    $note = $elements->first(fn (array $element): bool => isset($element['customData']));
    $frame = $elements->first(fn (array $element): bool => $element['type'] === 'frame' && $element['id'] !== ($note['frameId'] ?? null));
    $border = [$frame['x'], $frame['y'] + $frame['height'] / 2];
    $centre = [$note['x'] + $note['width'] / 2, $note['y'] + $note['height'] / 2];
    $seq = $board->fresh()->seq;
    $stamp = $this->whiteboardSceneStamp($board);

    $this->dragOnWhiteboard($page, $border, [$border[0] + 60, $border[1]]);

    $page->keys('.whiteboard-canvas .excalidraw-container', 'Delete');
    $this->settleWhiteboard($page);
    $page->assertAttribute('[data-scene]', 'data-scene', $stamp);

    expect($board->fresh()->seq)->toBe($seq);

    $this->dragOnWhiteboard($page, $centre, [$centre[0] + 40, $centre[1] + 30]);
    $this->awaitWhiteboardScene($page, $board);

    $movedNote = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('element_id', $note['id'])->sole();
    $sameFrame = WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('element_id', $frame['id'])->sole();

    expect($movedNote->data['x'])->toEqualWithDelta($note['x'] + 40, 2)
        ->and($movedNote->data['y'])->toEqualWithDelta($note['y'] + 30, 2)
        ->and($movedNote->is_deleted)->toBeFalse()
        ->and($sameFrame->version)->toBe(1)
        ->and($sameFrame->data['x'])->toBe($frame['x'])
        ->and($sameFrame->data['y'])->toBe($frame['y']);

    $page->keys('.whiteboard-canvas .excalidraw-container', 'Delete');

    $this->awaitWhiteboardElements($page, 10);
    $this->awaitWhiteboardScene($page, $board);

    expect($movedNote->fresh()->is_deleted)->toBeTrue()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->where('type', 'frame')->where('is_deleted', false)->where('version', 1)->count())->toBe(4);
});

it('[P17b-04] keeps every label inside its shape on a Flowchart and an Impact map created in French and in German', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    $locales = [
        'fr' => ['new' => 'Nouveau tableau blanc', 'create' => 'Créer', 'tiles' => ['Logigramme', "Carte d'impact"], 'word' => 'Légende'],
        'de' => ['new' => 'Neues Whiteboard', 'create' => 'Erstellen', 'tiles' => ['Flussdiagramm', 'Impact-Map'], 'word' => 'Legende'],
    ];

    $page = $this->signIn($fran, p17bTeamPath($team));

    foreach ($locales as $locale => $labels) {
        User::query()->whereKey($fran->id)->update(['locale' => $locale]);

        $words = '';

        foreach ($labels['tiles'] as $tile) {
            $page->navigate(p17bTeamPath($team));

            $board = p17bCreateBoard($page, $tile, "{$tile} {$locale}", $labels['new'], $labels['create']);

            $this->awaitRealtime($page);

            $elements = $this->whiteboardElements($page, $board);
            $labelCount = collect($elements)->where('type', 'text')->whereNotNull('containerId')->count();
            $words .= json_encode($elements, JSON_UNESCAPED_UNICODE);

            expect($labelCount)->toBeGreaterThan(3)
                ->and(p17bLabelsOutside($elements))->toBeArray()->toBeEmpty();
        }

        expect($words)->toContain($labels['word']);
    }
});

it('[P17b-05] shows the gallery in French to a French-speaking member and creates a SWOT board whose quadrants and notes are in French', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator', 'fr');
    $builtIns = "document.querySelectorAll('[role=\"dialog\"] [role=\"radiogroup\"]')[0]";

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("Nouveau tableau blanc")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertScript("Array.from({$builtIns}.querySelectorAll('[role=\"radio\"] span.font-medium')).map((name) => name.textContent).join('|')", "Vierge|Brainstorming|Logigramme|Carte des récits utilisateur|Carte d'impact|SWOT|Lean canvas|Matrice 2×2")
        ->assertSeeIn(p17bTile('Vierge'), 'Un canevas vide.')
        ->assertSeeIn(p17bTile('SWOT'), 'Forces, faiblesses, opportunités et menaces.')
        ->click(p17bTile('SWOT'))
        ->assertAriaAttribute(p17bTile('SWOT'), 'checked', 'true')
        ->fill('#whiteboard-title', 'SWOT FR')
        ->click('[role="dialog"] form button:text-is("Créer")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'SWOT FR')->sole();

    $this->awaitRealtime($page);

    $elements = collect($this->whiteboardElements($page, $board));
    $everything = json_encode($elements->all(), JSON_UNESCAPED_UNICODE);

    expect($elements->where('type', 'frame')->pluck('name')->sort()->values()->all())->toBe(['Faiblesses', 'Forces', 'Menaces', 'Opportunités'])
        ->and($elements->where('type', 'text')->pluck('text')->all())->toContain("Que faisons-nous\nbien ?")
        ->and($everything)->not->toContain('Strengths')
        ->and($everything)->not->toContain('Weaknesses')
        ->and($everything)->not->toContain('Opportunities')
        ->and($everything)->not->toContain('Threats')
        ->and($everything)->not->toContain('What ');
});

it('[P17b-06] keeps the new-whiteboard dialog usable at 375 pixels of width, without a horizontal scroll of the page and with a Create button that works', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->resize(375, 812)
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radio"]', 8)
        ->assertScript('document.documentElement.scrollWidth <= window.innerWidth', true)
        ->assertScript("document.querySelector('[role=\"dialog\"]').getBoundingClientRect().right <= window.innerWidth", true)
        ->click(p17bTile('Brainstorm'))
        ->assertAriaAttribute(p17bTile('Brainstorm'), 'checked', 'true')
        ->fill('#whiteboard-title', 'Narrow board')
        ->click('[role="dialog"] form button:text-is("Create")')
        ->assertPathBeginsWith('/whiteboards/');

    $board = Whiteboard::query()->where('title', 'Narrow board')->sole();

    expect($board->elements()->count())->toBe(9);
});

it('[P17b-07] draws every thumbnail on a white surface in the dark theme, with the frames of the Lean canvas, the shapes of the Flowchart and the outline of a workspace template', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Plain shapes',
        'preview' => ['width' => 300, 'height' => 100, 'shapes' => [
            ['kind' => 'rect', 'x' => 0, 'y' => 0, 'width' => 100, 'height' => 100, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []],
            ['kind' => 'ellipse', 'x' => 200, 'y' => 0, 'width' => 100, 'height' => 100, 'fill' => null, 'stroke' => '#1e1e1e', 'points' => []],
        ]],
        'created_by_user_id' => $fran->id,
    ]);

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->script("() => { localStorage.setItem('appearance', 'dark'); document.cookie = 'appearance=dark;path=/;max-age=31536000;SameSite=Lax'; return true; }");

    $page->navigate(p17bTeamPath($team))
        ->assertScript("document.documentElement.classList.contains('dark')", true)
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radio"]', 9)
        ->assertScript("Array.from(document.querySelectorAll('[role=\"dialog\"] [role=\"radio\"] > div')).filter((surface) => getComputedStyle(surface).backgroundColor == 'rgb(255, 255, 255)').length", 9)
        ->assertCount(p17bTile('Lean canvas').' svg rect[fill="none"][stroke="#1e1e1e"]', 9)
        ->assertCount(p17bTile('Flowchart').' svg ellipse', 3)
        ->assertCount(p17bTile('Flowchart').' svg polygon', 2)
        ->assertCount(p17bTile('Flowchart').' svg polyline', 5)
        ->assertCount(p17bTile('Plain shapes').' svg rect[stroke="#1e1e1e"]', 1)
        ->assertCount(p17bTile('Plain shapes').' svg ellipse[stroke="#1e1e1e"]', 1);
});

it('[P17b-08] saves a board as a workspace template from the board menu, says so, and lists the template with a thumbnail in the gallery of the team page', function () {
    Storage::fake();

    ['board' => $board, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($board, $franMember);

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($page, 4);

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Save as template")')
        ->assertSeeIn('[role="dialog"]', 'Everyone in the workspace can start a board from it.')
        ->fill('[role="dialog"] input[maxlength="80"]', 'Kick-off')
        ->fill('[role="dialog"] input[maxlength="300"]', 'How we start a project')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertSee('Template saved.')
        ->assertNotPresent('[role="dialog"]');

    $template = WhiteboardTemplate::query()->sole();
    $copy = "whiteboard-templates/{$template->id}/".P17bFileId;

    expect($template->workspace_id)->toBe($team->workspace_id)
        ->and($template->name)->toBe('Kick-off')
        ->and($template->description)->toBe('How we start a project')
        ->and($template->created_by_user_id)->toBe($fran->id)
        ->and($template->scene['elements'])->toHaveCount(4)
        ->and(array_column($template->scene['files'], 'path'))->toBe([$copy])
        ->and(Storage::exists($copy))->toBeTrue()
        ->and(json_encode($template->scene))->not->toContain($franMember->id)
        ->and(json_encode($template->scene))->not->toContain($fran->id);

    $page->click('a[aria-label="Back to the team"]')
        ->assertPathIs(p17bTeamPath($team))
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertSeeIn('[role="dialog"]', 'Workspace templates')
        ->assertSeeIn(p17bTile('Kick-off'), 'How we start a project')
        ->assertCount(p17bTile('Kick-off').' svg > *', 4)
        ->assertCount(p17bTile('Kick-off').' svg polyline', 1);
});

it('[P17b-09] keeps the save dialog open with the error under the name when the name is taken, whatever its case and the spaces around it', function () {
    Storage::fake();

    ['board' => $board, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($board, $franMember);
    WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Kick-off', 'created_by_user_id' => $fran->id]);
    $answered = "performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('/template') && entry.responseEnd > 0).length";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Save as template")')
        ->fill('[role="dialog"] input[maxlength="80"]', 'Kick-off')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertScript($answered, 1)
        ->assertSeeIn('[role="dialog"]', 'A template with this name already exists.')
        ->assertDontSee('Template saved.')
        ->fill('[role="dialog"] input[maxlength="80"]', '  kick-OFF  ')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertScript($answered, 2)
        ->assertSeeIn('[role="dialog"]', 'A template with this name already exists.')
        ->assertPresent('[role="dialog"] input[maxlength="80"]')
        ->assertDontSee('Template saved.');

    expect(WhiteboardTemplate::query()->where('workspace_id', $team->workspace_id)->pluck('name')->all())->toBe(['Kick-off']);
});

it('[P17b-10] gives another member who picks the workspace template a board with the same elements and image, the arrow still bound, fresh ids and no trace of the source author', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', 'How we start a project');
    $mia = renamedWhiteboardUser(teamMember($team), 'Mia Member');

    $page = $this->signIn($mia, p17bTeamPath($team));
    $board = p17bCreateBoard($page, 'Kick-off', 'From template');

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    $snapshot = $this->whiteboardSnapshot($page, $board);
    $elements = collect($snapshot['elements']);
    $shape = $elements->first(fn (array $element): bool => $element['type'] === 'rectangle' && ! isset($element['customData']));
    $arrow = $elements->firstWhere('type', 'arrow');
    $image = $elements->firstWhere('type', 'image');
    $rows = WhiteboardElement::query()->where('whiteboard_id', $board->id)->get();
    $file = WhiteboardFile::query()->where('whiteboard_id', $board->id)->sole();

    $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.endsWith('/files/".P17bFileId."') && entry.responseEnd > 0)", true);

    expect($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['me']['name'])->toBe('Mia Member')
        ->and($elements->pluck('type')->sort()->values()->all())->toBe(['arrow', 'image', 'rectangle', 'rectangle'])
        ->and($elements->filter(fn (array $element): bool => isset($element['customData'])))->toHaveCount(1)
        ->and($arrow['startBinding']['elementId'])->toBe($shape['id'])
        ->and($shape['boundElements'])->toBe([['id' => $arrow['id'], 'type' => 'arrow']])
        ->and($image['fileId'])->toBe(P17bFileId)
        ->and($elements->pluck('id')->intersect(['p17bSticky', 'p17bShape', 'p17bArrow', 'p17bImage'])->all())->toBeEmpty()
        ->and($rows->pluck('version')->unique()->all())->toBe([1])
        ->and($rows->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($board->facilitator->user_id)->toBe($mia->id)
        ->and($board->facilitator_member_id)->not->toBe($franMember->id)
        ->and($file->file_id)->toBe(P17bFileId)
        ->and($file->path)->toBe("whiteboards/{$board->id}/".P17bFileId)
        ->and($page->script(p17bFileDownload($board)))->toBe('200 image/png '.strlen(base64_decode(WhiteboardPng)))
        ->and(WhiteboardFile::query()->where('whiteboard_id', $source->id)->count())->toBe(1);
});

it('[P17b-11] keeps the source board and the board created from its template apart when each is edited, after a reload too', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    $template = resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', null);
    $mia = renamedWhiteboardUser(teamMember($team), 'Mia Member');
    $copy = resolve(CreateWhiteboard::class)->handle($team, $mia, 'From template', $template->scene);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($source)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($copy)));

    $this->awaitWhiteboardElements($franPage, 4);
    $this->awaitWhiteboardElements($miaPage, 4);

    $sourceSticky = WhiteboardElement::query()->where('whiteboard_id', $source->id)->where('element_id', 'p17bSticky')->sole();
    $sourceShape = WhiteboardElement::query()->where('whiteboard_id', $source->id)->where('element_id', 'p17bShape')->sole();
    $copySticky = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->where('is_sticky', true)->sole();

    $onSource = $this->writeWhiteboardElements($franPage, $source, [
        [...$sourceSticky->data, 'version' => $sourceSticky->version + 1, 'versionNonce' => 9001, 'x' => 900],
        [...$sourceShape->data, 'version' => $sourceShape->version + 1, 'versionNonce' => 9002, 'isDeleted' => true],
    ]);
    $onCopy = $this->writeWhiteboardElements($miaPage, $copy, [
        [...$copySticky->data, 'version' => $copySticky->version + 1, 'versionNonce' => 9003, 'y' => 700],
    ]);

    expect($onSource['status'])->toBe(200)
        ->and($onSource['body']['rejected'])->toBeArray()->toBeEmpty()
        ->and($onCopy['status'])->toBe(200)
        ->and($onCopy['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardElements($franPage, 3);
    $this->awaitWhiteboardScene($franPage, $source);
    $this->awaitWhiteboardScene($miaPage, $copy);

    $franPage->navigate($this->whiteboardPath($source));
    $miaPage->navigate($this->whiteboardPath($copy));

    $this->awaitRealtime($franPage);
    $this->awaitRealtime($miaPage);
    $this->awaitWhiteboardElements($franPage, 3);
    $this->awaitWhiteboardElements($miaPage, 4);
    $this->awaitWhiteboardScene($franPage, $source);
    $this->awaitWhiteboardScene($miaPage, $copy);

    $sourceNow = collect($this->whiteboardElements($franPage, $source));
    $copyNow = collect($this->whiteboardElements($miaPage, $copy));

    expect($sourceNow)->toHaveCount(3)
        ->and($sourceNow->firstWhere('id', 'p17bSticky')['x'])->toBe(900)
        ->and($sourceNow->firstWhere('id', 'p17bSticky')['y'])->toBe(100)
        ->and($sourceNow->pluck('id')->all())->not->toContain('p17bShape')
        ->and($copyNow)->toHaveCount(4)
        ->and($copyNow->firstWhere('id', $copySticky->element_id)['x'])->toBe(100)
        ->and($copyNow->firstWhere('id', $copySticky->element_id)['y'])->toBe(700)
        ->and($copyNow->filter(fn (array $element): bool => $element['type'] === 'rectangle' && ! isset($element['customData'])))->toHaveCount(1);
});

it('[P17b-12] renames a template and edits its description in the templates dialog, refuses the name of another template, and leaves a board created from it unchanged', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off',
        'description' => 'How we start a project',
        'scene' => ['elements' => [sceneElement(['id' => 'p17bOnly', 'x' => 300, 'y' => 200])], 'files' => []],
        'created_by_user_id' => $fran->id,
    ]);
    WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Second', 'created_by_user_id' => $fran->id]);
    $board = resolve(CreateWhiteboard::class)->handle($team, $fran, 'From template', $template->scene);
    $boardBefore = $board->fresh()->only(['title', 'seq']);
    $elementBefore = $board->elements()->sole()->data;
    $name = "#whiteboard-template-{$template->id}-name";
    $description = "#whiteboard-template-{$template->id}-description";

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent(p17bTemplateRow('Kick-off'))
        ->assertPresent(p17bTemplateRow('Second'))
        ->click(p17bTemplateRow('Kick-off').' button:text-is("Edit")')
        ->fill($name, 'Renamed')
        ->fill($description, 'Edited description')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertPresent(p17bTemplateRow('Renamed'))
        ->assertSeeIn(p17bTemplateRow('Renamed'), 'Edited description')
        ->assertNotPresent(p17bTemplateRow('Kick-off'));

    expect($template->fresh()->only(['name', 'description']))->toBe(['name' => 'Renamed', 'description' => 'Edited description']);

    $page->click(p17bTemplateRow('Renamed').' button:text-is("Edit")')
        ->fill($name, ' second ')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertSeeIn('[role="dialog"]', 'A template with this name already exists.')
        ->assertPresent($name)
        ->click('[role="dialog"] form button:text-is("Cancel")')
        ->assertPresent(p17bTemplateRow('Renamed'));

    expect($template->fresh()->name)->toBe('Renamed');

    $page->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertSeeIn(p17bTile('Renamed'), 'Edited description')
        ->assertNotPresent(p17bTile('Kick-off'));

    expect($board->fresh()->only(['title', 'seq']))->toBe($boardBefore)
        ->and($board->elements()->sole()->data)->toBe($elementBefore);
});

it('[P17b-13] offers neither Edit nor Delete on a template to a member who did not create it, and the server refuses both', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    $mia = renamedWhiteboardUser(teamMember($team), 'Mia Member');
    $template = WhiteboardTemplate::factory()->create([
        'workspace_id' => $team->workspace_id,
        'name' => 'Kick-off',
        'description' => 'How we start a project',
        'created_by_user_id' => $fran->id,
    ]);
    $templatePath = Str::before(p17bTeamPath($team), '/teams/')."/whiteboard-templates/{$template->id}";

    $page = $this->signIn($mia, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent(p17bTemplateRow('Kick-off'))
        ->assertSeeIn(p17bTemplateRow('Kick-off'), 'How we start a project')
        ->assertNotPresent('[role="dialog"] li button');

    $update = $this->sendFromPage($page, 'PATCH', $templatePath, ['name' => 'Taken over']);
    $delete = $this->sendFromPage($page, 'DELETE', $templatePath);

    expect($update['status'])->toBe(403)
        ->and($update['body']['message'])->toBe('Only the creator of this template or a workspace admin can change it.')
        ->and($delete['status'])->toBe(403)
        ->and($template->fresh()->name)->toBe('Kick-off');
});

it('[P17b-14] lets a workspace admin who created neither template edit one and delete the other', function () {
    $team = Team::factory()->create();
    $fran = renamedWhiteboardUser(teamMember($team), 'Fran Facilitator');
    $ada = renamedWhiteboardUser(workspaceManager($team->workspace), 'Ada Admin');
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Kick-off', 'created_by_user_id' => $fran->id]);
    $second = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Second', 'created_by_user_id' => $fran->id]);

    $page = $this->signIn($ada, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->assertPresent(p17bTemplateRow('Kick-off').' button:text-is("Edit")')
        ->assertPresent(p17bTemplateRow('Kick-off').' button:text-is("Delete")')
        ->assertPresent(p17bTemplateRow('Second').' button:text-is("Edit")')
        ->assertPresent(p17bTemplateRow('Second').' button:text-is("Delete")')
        ->click(p17bTemplateRow('Kick-off').' button:text-is("Edit")')
        ->fill("#whiteboard-template-{$template->id}-description", 'Edited by the admin')
        ->click('[role="dialog"] form button:text-is("Save")')
        ->assertSeeIn(p17bTemplateRow('Kick-off'), 'Edited by the admin')
        ->click(p17bTemplateRow('Second').' button:text-is("Delete")')
        ->assertSeeIn(p17bTemplateRow('Second'), 'Delete this template?')
        ->assertSeeIn(p17bTemplateRow('Second'), 'Boards already created from it are not changed.')
        ->click(p17bTemplateRow('Second').' div.bg-muted button:text-is("Delete")')
        ->assertNotPresent(p17bTemplateRow('Second'))
        ->assertPresent(p17bTemplateRow('Kick-off'));

    expect($template->fresh()->description)->toBe('Edited by the admin')
        ->and($template->fresh()->created_by_user_id)->toBe($fran->id)
        ->and(WhiteboardTemplate::query()->whereKey($second->id)->exists())->toBeFalse();
});

it('[P17b-15] still opens a board created from a template, with its elements and its image, after the template and the source board are deleted', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    $template = resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', null);
    $board = resolve(CreateWhiteboard::class)->handle($team, $fran, 'From template', $template->scene);
    $templateFile = "whiteboard-templates/{$template->id}/".P17bFileId;
    $sourceFile = "whiteboards/{$source->id}/".P17bFileId;

    expect(Storage::exists($templateFile))->toBeTrue();

    $page = $this->signIn($fran, p17bTeamPath($team));

    $page->click('button:text-is("Whiteboard templates")')
        ->click(p17bTemplateRow('Kick-off').' button:text-is("Delete")')
        ->assertSeeIn(p17bTemplateRow('Kick-off'), 'Delete this template?')
        ->click(p17bTemplateRow('Kick-off').' div.bg-muted button:text-is("Delete")')
        ->assertSeeIn('[role="dialog"]', 'No whiteboard templates yet.')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->click('button[aria-label="Delete Source board"]')
        ->assertSeeIn('[role="dialog"]', 'Delete this board?')
        ->click('[role="dialog"] button:text-is("Delete this board")')
        ->assertNotPresent("a[href=\"/whiteboards/{$source->id}\"]")
        ->assertNotPresent('[role="dialog"]');

    expect(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(Whiteboard::query()->whereKey($source->id)->exists())->toBeFalse()
        ->and(Storage::exists($templateFile))->toBeFalse()
        ->and(Storage::exists($sourceFile))->toBeFalse();

    $page->click("a[href=\"/whiteboards/{$board->id}\"]")
        ->assertPathIs($this->whiteboardPath($board));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    expect($this->whiteboardElements($page, $board))->toHaveCount(4)
        ->and($page->script(p17bFileDownload($board)))->toBe('200 image/png '.strlen(base64_decode(WhiteboardPng)));

    $page->click('a[aria-label="Back to the team"]')
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radiogroup"]', 1)
        ->assertDontSee('Workspace templates');
});

it('[P17b-16] lists Duplicate this board and Save as template in a member\'s board menu and neither in a guest\'s', function () {
    ['board' => $board, 'fran' => $fran] = p17bBoard(['guest_access_enabled' => true]);

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $this->openWhiteboardMenu($franPage)
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Duplicate this board")')
        ->assertPresent('[role="menu"] [role="menuitem"]:has-text("Save as template")');

    $this->openWhiteboardMenu($guestPage)
        ->assertPresent('[role="menu"] [role="menuitemcheckbox"]:has-text("Hide my cursor")')
        ->assertCount('[role="menu"] [role="menuitemcheckbox"]', 1)
        ->assertCount('[role="menu"] [role="menuitem"]', 0)
        ->assertDontSeeIn('[role="menu"]', 'Duplicate this board')
        ->assertDontSeeIn('[role="menu"]', 'Save as template');

    expect($this->whiteboardSnapshot($guestPage, $board)['me']['isGuest'])->toBeTrue();
});

it('[P17b-17] refuses a guest who posts a template or a duplicate of the board, with 403, and creates nothing', function () {
    ['board' => $board, 'fran' => $fran] = p17bBoard(['guest_access_enabled' => true]);

    $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $template = $this->sendFromPage($guestPage, 'POST', "/whiteboards/{$board->id}/template", ['name' => 'x']);
    $duplicate = $this->sendFromPage($guestPage, 'POST', "/whiteboards/{$board->id}/duplicate");

    expect($template['status'])->toBe(403)
        ->and($template['body']['message'])->toBe('Guests cannot do this.')
        ->and($duplicate['status'])->toBe(403)
        ->and($duplicate['body']['message'])->toBe('Guests cannot do this.')
        ->and(WhiteboardTemplate::query()->count())->toBe(0)
        ->and(Whiteboard::query()->count())->toBe(1);

    $guestPage->assertPresent('[data-realtime="connected"]');
});

it('[P17b-18] sends a guest who opens the team page to the login page, and answers 401 to the guest\'s requests on templates and on the team\'s boards', function () {
    ['board' => $board, 'team' => $team, 'fran' => $fran] = p17bBoard(['guest_access_enabled' => true]);
    $template = WhiteboardTemplate::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Kick-off', 'created_by_user_id' => $fran->id]);
    $templatePath = Str::before(p17bTeamPath($team), '/teams/')."/whiteboard-templates/{$template->id}";

    $guestPage = $this->awaitRealtime($this->joinAsGuest($this->whiteboardJoinPath($board), 'Guest Gia'));

    $update = $this->sendFromPage($guestPage, 'PATCH', $templatePath, ['name' => 'Taken over']);
    $delete = $this->sendFromPage($guestPage, 'DELETE', $templatePath);
    $create = $this->sendFromPage($guestPage, 'POST', p17bTeamPath($team).'/whiteboards', ['title' => 'Guest board', 'workspace_template_id' => $template->id]);

    expect($update['status'])->toBe(401)
        ->and($delete['status'])->toBe(401)
        ->and($create['status'])->toBe(401)
        ->and($template->fresh()->name)->toBe('Kick-off')
        ->and(Whiteboard::query()->count())->toBe(1);

    $guestPage->navigate(p17bTeamPath($team))
        ->assertPathIs('/login')
        ->assertDontSee('Kick-off')
        ->assertDontSee('Whiteboard templates')
        ->assertDontSee('New whiteboard');
});

it('[P17b-19] offers PNG, SVG and the clipboard in the image export, and asks to save files named after the board title', function () {
    Storage::fake();

    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Export board']);
    p17bScene($board, $franMember);

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($page, 4);
    p17bRecordDownloads($page);

    $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->click('[data-testid="dropdown-menu"] [data-testid="image-export-button"]')
        ->assertPresent('.ImageExportModal')
        ->assertPresent('.ImageExportModal__preview__canvas canvas')
        ->assertCount('.ImageExportModal__settings__buttons button', 3)
        ->assertPresent('.ImageExportModal button[aria-label="Copy PNG to clipboard"]')
        ->click('.ImageExportModal button[aria-label="Export to PNG"]')
        ->assertScript("window.p17bDownloads.names.includes('Export board.png')", true)
        ->click('.ImageExportModal button[aria-label="Export to SVG"]')
        ->assertScript("window.p17bDownloads.names.includes('Export board.svg')", true);
});

it('[P17b-20] downloads the board data as a file named after the board title, which holds the elements and the image of the board', function () {
    Storage::fake();

    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Export board']);
    p17bScene($board, $franMember);
    $holdsImage = "(async () => { document.querySelector('.ExportDialog--json button').click(); const blob = window.p17bDownloads.blobs.at(-1); const scene = JSON.parse(await blob.text()); return Object.keys(scene.files ?? {}).includes('".P17bFileId."'); })()";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($page, 4);
    p17bRecordDownloads($page);

    $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->click('[data-testid="dropdown-menu"] [data-testid="json-export-button"]')
        ->assertPresent('.ExportDialog--json')
        ->assertSeeIn('.ExportDialog--json', 'Download everything on the board as a data file.')
        ->assertCount('.ExportDialog--json button', 1)
        ->assertNotPresent('.ExportDialog--json .Card')
        ->click('.ExportDialog--json button:text-is("Download board data")')
        ->assertScript("window.p17bDownloads.names.includes('Export board.whiteboard.json')", true)
        ->assertScript($holdsImage, true);

    $exported = json_decode((string) $page->script(<<<'SCRIPT'
        async () => {
            const blob = window.p17bDownloads.blobs.at(-1);
            const scene = JSON.parse(await blob.text());

            return JSON.stringify({
                type: blob.type,
                source: scene.source,
                origin: window.location.origin,
                ids: scene.elements.filter((element) => !element.isDeleted).map((element) => element.id).sort(),
                names: window.p17bDownloads.names,
            });
        }
        SCRIPT), true, flags: JSON_THROW_ON_ERROR);

    expect($exported['type'])->toBe('application/json')
        ->and($exported['source'])->toBe($exported['origin'])
        ->and($exported['ids'])->toBe(['p17bArrow', 'p17bImage', 'p17bShape', 'p17bSticky'])
        ->and(collect($exported['names'])->filter(fn (string $name): bool => str_ends_with($name, '.excalidraw'))->all())->toBeEmpty();
});

it('[P17b-22] shows no library name and no outbound link in the canvas menu and in the two export dialogs', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Export board']);
    p17bStored($board, $franMember, ['id' => 'p17bOnly', 'x' => 300, 'y' => 200], 1);
    $links = fn (string $scope): string => "Array.from(document.querySelectorAll('{$scope} a[href]')).filter((link) => link.getClientRects().length > 0).length";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->awaitWhiteboardElements($page, 1);

    $page->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->assertPresent('[data-testid="dropdown-menu"] [data-testid="json-export-button"]')
        ->assertNotPresent('[data-testid="dropdown-menu"] a[href]')
        ->assertDontSeeIn('[data-testid="dropdown-menu"]', 'Excalidraw')
        ->click('[data-testid="dropdown-menu"] [data-testid="image-export-button"]')
        ->assertPresent('.ImageExportModal')
        ->assertScript($links('.ImageExportModal'), 0)
        ->assertDontSeeIn('.ImageExportModal', 'Excalidraw')
        ->keys('.ImageExportModal button[aria-label="Export to PNG"]', 'Escape')
        ->assertNotPresent('.ImageExportModal')
        ->click('.whiteboard-canvas [data-testid="main-menu-trigger"]')
        ->click('[data-testid="dropdown-menu"] [data-testid="json-export-button"]')
        ->assertPresent('.ExportDialog--json')
        ->assertScript($links('.excalidraw-modal-container'), 0)
        ->assertDontSeeIn('.excalidraw-modal-container', 'Excalidraw')
        ->assertDontSee('Excalidraw');
});

it('[P17b-23] duplicates a board from its menu and lands on the copy, with the same elements and image, the member as facilitator and the default settings', function () {
    Storage::fake();

    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['guest_access_enabled' => true, 'cursors_enabled' => false]);
    p17bScene($source, $franMember);

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($source)));

    $this->awaitWhiteboardElements($page, 4);

    $sourceShapes = p17bShapes($this->whiteboardElements($page, $source));

    $this->openWhiteboardMenu($page)
        ->click('[role="menuitem"]:has-text("Duplicate this board")')
        ->assertPathIsNot($this->whiteboardPath($source))
        ->assertSeeIn('header > h1', 'Sprint board (copy)');

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();

    $page->assertPathIs($this->whiteboardPath($copy));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    $snapshot = $this->whiteboardSnapshot($page, $copy);
    $rows = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->get();

    expect($snapshot['board']['title'])->toBe('Sprint board (copy)')
        ->and($snapshot['me']['isFacilitator'])->toBeTrue()
        ->and($snapshot['me']['name'])->toBe('Fran Facilitator')
        ->and($snapshot['board']['guestAccessEnabled'])->toBeFalse()
        ->and($snapshot['board']['cursorsEnabled'])->toBeTrue()
        ->and($snapshot['board']['reactionsEnabled'])->toBeTrue()
        ->and(p17bShapes($snapshot['elements']))->toBe($sourceShapes)
        ->and($rows->pluck('version')->unique()->all())->toBe([1])
        ->and($rows->pluck('element_id')->intersect(['p17bSticky', 'p17bShape', 'p17bArrow', 'p17bImage'])->all())->toBeEmpty()
        ->and($copy->team_id)->toBe($source->team_id)
        ->and($copy->guest_token)->not->toBe($source->guest_token)
        ->and($page->script(p17bFileDownload($copy)))->toBe('200 image/png '.strlen(base64_decode(WhiteboardPng)))
        ->and(WhiteboardFile::query()->where('whiteboard_id', $copy->id)->sole()->path)->toBe("whiteboards/{$copy->id}/".P17bFileId);
});

it('[P17b-24] makes a second member the facilitator of the copy she duplicates, while the source keeps its facilitator and its page shows nothing of it', function () {
    Storage::fake();

    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($source, $franMember);
    [$mia] = whiteboardMember($source);
    renamedWhiteboardUser($mia, 'Mia Member');

    $franPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($source)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, $this->whiteboardPath($source)));

    $this->awaitWhiteboardElements($franPage, 4);
    $this->awaitWhiteboardElements($miaPage, 4);
    $this->awaitWhiteboardScene($franPage, $source);

    $seq = $source->fresh()->seq;

    $this->openWhiteboardMenu($miaPage)
        ->click('[role="menuitem"]:has-text("Duplicate this board")')
        ->assertPathIsNot($this->whiteboardPath($source))
        ->assertSeeIn('header > h1', 'Sprint board (copy)');

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();

    $this->awaitRealtime($miaPage);

    expect($this->whiteboardSnapshot($miaPage, $copy)['me']['isFacilitator'])->toBeTrue()
        ->and($copy->facilitator->user_id)->toBe($mia->id)
        ->and($source->fresh()->facilitator_member_id)->toBe($franMember->id)
        ->and($source->fresh()->seq)->toBe($seq);

    $this->addWhiteboardElement($franPage, $source, ['type' => 'ellipse', 'x' => 900, 'y' => 500]);
    $this->awaitWhiteboardElements($franPage, 5);

    $franSnapshot = $this->whiteboardSnapshot($franPage, $source);

    $franPage->assertSeeIn('header > h1', 'Sprint board')
        ->assertDontSee('(copy)')
        ->assertNotPresent('[data-sonner-toast]')
        ->assertPresent('[role="toolbar"][aria-label="Facilitation tools"]');

    expect($franSnapshot['me']['isFacilitator'])->toBeTrue()
        ->and($franSnapshot['board']['facilitatorMemberId'])->toBe($franMember->id)
        ->and($copy->elements()->count())->toBe(4);
});

it('[P17b-25] leaves the original unchanged when the copy is edited, after a reload of the original too', function () {
    Storage::fake();

    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bScene($source, $franMember);
    $copy = resolve(DuplicateWhiteboard::class)->handle($source, $fran);
    $copySticky = WhiteboardElement::query()->where('whiteboard_id', $copy->id)->where('is_sticky', true)->sole();
    $sourceBefore = WhiteboardElement::query()->where('whiteboard_id', $source->id)->orderBy('seq')->get()->map(fn (WhiteboardElement $element): array => $element->data)->all();

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($copy)));

    $this->awaitWhiteboardElements($page, 4);

    $removal = $this->writeWhiteboardElements($page, $copy, [
        [...$copySticky->data, 'version' => $copySticky->version + 1, 'versionNonce' => 9004, 'isDeleted' => true],
    ]);

    expect($removal['status'])->toBe(200)
        ->and($removal['body']['rejected'])->toBeArray()->toBeEmpty();

    $this->awaitWhiteboardElements($page, 3);
    $this->awaitWhiteboardScene($page, $copy);

    $page->navigate($this->whiteboardPath($source));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    $page->assertSeeIn('header > h1', 'Sprint board')
        ->assertDontSee('(copy)');

    expect(p17bShapes($this->whiteboardElements($page, $source)))->toBe(p17bShapes($sourceBefore))
        ->and(collect($this->whiteboardElements($page, $source))->pluck('id')->sort()->values()->all())->toBe(['p17bArrow', 'p17bImage', 'p17bShape', 'p17bSticky'])
        ->and(WhiteboardElement::query()->where('whiteboard_id', $copy->id)->where('is_deleted', false)->count())->toBe(3);
});

it('[P17b-26] ends the title of a copy with the French word when the member who duplicates uses French', function () {
    ['board' => $source, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Carte du sprint']);
    p17bStored($source, $franMember, ['id' => 'p17bOnly', 'x' => 300, 'y' => 200], 1);
    renamedWhiteboardUser($fran, 'Fran Facilitator', 'fr');

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($source)));

    $this->openWhiteboardMenu($page, 'Menu du tableau')
        ->click('[role="menuitem"]:has-text("Dupliquer ce tableau")')
        ->assertPathIsNot($this->whiteboardPath($source))
        ->assertSeeIn('header > h1', 'Carte du sprint (copie)');

    $copy = Whiteboard::query()->whereKeyNot($source->id)->sole();

    expect($copy->title)->toBe('Carte du sprint (copie)')
        ->and($copy->elements()->count())->toBe(1);
});

it('[P17b-27] shows the trash button to each member only on the boards she facilitates, and to a workspace admin on every board', function () {
    ['board' => $franBoard, 'team' => $team, 'fran' => $fran] = p17bBoard(['title' => 'Fran board']);
    $miaBoard = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Mia board']);
    [$mia] = whiteboardFacilitator($miaBoard);
    renamedWhiteboardUser($mia, 'Mia Member');
    $ada = renamedWhiteboardUser(workspaceManager($team->workspace), 'Ada Admin');
    $franTrash = 'button[aria-label="Delete Fran board"]';
    $miaTrash = 'button[aria-label="Delete Mia board"]';

    $franPage = $this->signIn($fran, p17bTeamPath($team));

    $franPage->assertSeeIn("a[href=\"/whiteboards/{$franBoard->id}\"]", 'Facilitated by Fran Facilitator')
        ->assertSeeIn("a[href=\"/whiteboards/{$miaBoard->id}\"]", 'Facilitated by Mia Member')
        ->assertPresent($franTrash)
        ->assertNotPresent($miaTrash);

    $miaPage = $this->signIn($mia, p17bTeamPath($team));

    $miaPage->assertPresent("a[href=\"/whiteboards/{$franBoard->id}\"]")
        ->assertPresent($miaTrash)
        ->assertNotPresent($franTrash);

    $adaPage = $this->signIn($ada, p17bTeamPath($team));

    $adaPage->assertPresent("a[href=\"/whiteboards/{$franBoard->id}\"]")
        ->assertPresent($franTrash)
        ->assertPresent($miaTrash);
});

it('[P17b-28] removes a board from the list without a page load when its facilitator deletes it, and tells an open tab on that board that it was deleted', function () {
    ['board' => $board, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bStored($board, $franMember, ['id' => 'p17bOnly', 'x' => 300, 'y' => 200], 1);
    $kept = Whiteboard::factory()->create(['team_id' => $team->id, 'title' => 'Kept board']);

    $boardPage = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));
    $teamPage = $this->signIn($fran, p17bTeamPath($team));

    $teamPage->assertPresent("a[href=\"/whiteboards/{$board->id}\"]");
    $teamPage->script('() => { window.p17bSamePage = true; return true; }');

    $teamPage->click('button[aria-label="Delete Sprint board"]')
        ->assertSeeIn('[role="dialog"]', 'Delete this board?')
        ->assertSeeIn('[role="dialog"]', 'Everything on it is removed for everyone.')
        ->click('[role="dialog"] button:text-is("Delete this board")')
        ->assertNotPresent("a[href=\"/whiteboards/{$board->id}\"]")
        ->assertNotPresent('[role="dialog"]')
        ->assertPresent("a[href=\"/whiteboards/{$kept->id}\"]")
        ->assertScript('window.p17bSamePage === true', true);

    $boardPage->assertSee('This board was deleted.')
        ->assertNotPresent('[data-realtime]')
        ->assertNotPresent('.whiteboard-canvas');

    expect(Whiteboard::query()->whereKey($board->id)->exists())->toBeFalse()
        ->and(WhiteboardElement::query()->where('whiteboard_id', $board->id)->count())->toBe(0)
        ->and(Whiteboard::query()->whereKey($kept->id)->exists())->toBeTrue();
});

it('[P17b-29] reloads the scene from the snapshot when the delta it asks for is older than the purge mark, without losing anything and without the reconnecting banner', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bStored($board, $franMember, ['id' => 'p17bFirst', 'index' => 'a0', 'x' => 300, 'y' => 200], 1);
    $refused = "performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=1') && entry.responseStatus === 409)";

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->awaitResync($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)", true);

    $snapshotsBefore = (int) $page->script('() => '.p17bSnapshotRequests());

    p17bStored($board, $franMember, ['id' => 'p17bBehind', 'index' => 'a1', 'x' => 600, 'y' => 200, 'versionNonce' => 201], 2);
    Whiteboard::query()->whereKey($board->id)->update(['purged_seq' => 2]);

    $this->addWhiteboardElement($page, $board, ['x' => 900, 'y' => 200]);

    $this->awaitWhiteboardElements($page, 3);
    $this->awaitWhiteboardScene($page, $board);

    $page->assertScript($refused, true)
        ->assertDontSee('Reconnecting…')
        ->assertPresent('[data-realtime="connected"]');

    expect((int) $page->script('() => '.p17bSnapshotRequests()))->toBeGreaterThan($snapshotsBefore)
        ->and(collect($this->whiteboardElements($page, $board))->pluck('id')->all())->toContain('p17bFirst', 'p17bBehind')
        ->and($board->fresh()->seq)->toBe(3);
});

it('[P17b-30a] keeps the reconnecting banner while the snapshot cannot be fetched, tries again, and clears the banner once the snapshot arrives', function () {
    ['board' => $board, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard();
    p17bStored($board, $franMember, ['id' => 'p17bFirst', 'index' => 'a0', 'x' => 300, 'y' => 200], 1);

    $page = $this->awaitRealtime($this->signIn($fran, $this->whiteboardPath($board)));

    $this->awaitResync($page);
    $this->awaitWhiteboardElements($page, 1);

    $page->assertScript("performance.getEntriesByType('resource').some((entry) => entry.name.includes('/elements?since=') && entry.responseEnd > 0)", true)
        ->assertDontSee('Reconnecting…');

    $this->blockWhiteboardRequests($page, '/snapshot');
    p17bStored($board, $franMember, ['id' => 'p17bBehind', 'index' => 'a1', 'x' => 600, 'y' => 200, 'versionNonce' => 201], 2);
    Whiteboard::query()->whereKey($board->id)->update(['purged_seq' => 2]);

    $this->addWhiteboardElement($page, $board, ['x' => 900, 'y' => 200]);

    $page->assertScript('window.whiteboardBlocked.refused >= 1', true)
        ->assertSee('Reconnecting…')
        ->assertScript('window.whiteboardBlocked.refused >= 2', true)
        ->assertSee('Reconnecting…')
        ->assertAttribute('[data-scene]', 'data-scene', '1:1:100');

    $this->unblockWhiteboardRequests($page);

    $this->awaitWhiteboardElements($page, 3);

    $page->assertDontSee('Reconnecting…');

    $this->awaitWhiteboardScene($page, $board);

    expect(collect($this->whiteboardElements($page, $board))->pluck('id')->all())->toContain('p17bFirst', 'p17bBehind');
});
