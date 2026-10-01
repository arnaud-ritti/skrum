<?php

use App\Actions\Whiteboards\CreateWhiteboard;
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

const P17bPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const P17bFileId = 'p17bImage0001';

function p17bRenamed(User $user, string $name, string $locale = 'en'): User
{
    $user->forceFill(['name' => $name, 'locale' => $locale])->save();

    return $user;
}

function p17bTeamPath(Team $team): string
{
    return route('teams.show', [$team->workspace, $team], false);
}

function p17bBoardPath(Whiteboard $board): string
{
    return "/whiteboards/{$board->id}";
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
        'fran' => p17bRenamed($fran, 'Fran Facilitator'),
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
    $bytes = base64_decode(P17bPng);

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

function p17bOpenBoardMenu(mixed $page, string $label = 'Board menu'): mixed
{
    $page->assertNotPresent('[role="menu"]')
        ->click("[aria-label=\"{$label}\"]")
        ->assertPresent('[role="menu"]');

    return $page;
}

function p17bTemplateRow(string $name): string
{
    return "[role=\"dialog\"] li:has(p:text-is(\"{$name}\"))";
}

/**
 * @param  array<string, mixed>  $body
 * @return array{
 *     status: int,
 *     body: array<string, mixed>
 * }
 */
function p17bSend(mixed $page, string $method, string $path, array $body = []): array
{
    $request = json_encode([
        'method' => $method,
        'path' => $path,
        'body' => json_encode($body, JSON_THROW_ON_ERROR | JSON_FORCE_OBJECT),
    ], JSON_THROW_ON_ERROR);

    $answer = json_decode((string) $page->script(<<<JS
        async () => {
            const request = {$request};
            const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));
            const response = await fetch(request.path, {
                method: request.method,
                credentials: 'same-origin',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)),
                },
                body: request.body,
            });

            return JSON.stringify({ status: response.status, body: await response.text() });
        }
        JS), true, flags: JSON_THROW_ON_ERROR);

    return ['status' => $answer['status'], 'body' => json_decode((string) $answer['body'], true) ?? []];
}

function p17bFileDownload(Whiteboard $board): string
{
    $path = "/whiteboards/{$board->id}/files/".P17bFileId;

    return "() => fetch('{$path}').then((response) => response.blob().then((blob) => response.status + ' ' + blob.type + ' ' + blob.size))";
}

it('[P17b-01a] offers eight built-in templates with Blank first and selected, each with a thumbnail, a name and a description, and lists a workspace template apart', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');

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
    $page->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 800))');
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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator', 'fr');
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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');

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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
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

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    $this->awaitWhiteboardElements($page, 4);

    p17bOpenBoardMenu($page)
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

    $page = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($board)));

    p17bOpenBoardMenu($page)
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
    $mia = p17bRenamed(teamMember($team), 'Mia Member');

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
        ->and($page->script(p17bFileDownload($board)))->toBe('200 image/png '.strlen(base64_decode(P17bPng)))
        ->and(WhiteboardFile::query()->where('whiteboard_id', $source->id)->count())->toBe(1);
});

it('[P17b-11] keeps the source board and the board created from its template apart when each is edited, after a reload too', function () {
    Storage::fake();

    ['board' => $source, 'team' => $team, 'fran' => $fran, 'franMember' => $franMember] = p17bBoard(['title' => 'Source board']);
    p17bScene($source, $franMember);
    $template = resolve(SaveWhiteboardTemplate::class)->handle($source, $fran, 'Kick-off', null);
    $mia = p17bRenamed(teamMember($team), 'Mia Member');
    $copy = resolve(CreateWhiteboard::class)->handle($team, $mia, 'From template', $template->scene);

    $franPage = $this->awaitRealtime($this->signIn($fran, p17bBoardPath($source)));
    $miaPage = $this->awaitRealtime($this->signIn($mia, p17bBoardPath($copy)));

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

    $franPage->navigate(p17bBoardPath($source));
    $miaPage->navigate(p17bBoardPath($copy));

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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
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
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $mia = p17bRenamed(teamMember($team), 'Mia Member');
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

    $update = p17bSend($page, 'PATCH', $templatePath, ['name' => 'Taken over']);
    $delete = p17bSend($page, 'DELETE', $templatePath);

    expect($update['status'])->toBe(403)
        ->and($update['body']['message'])->toBe('Only the creator of this template or a workspace admin can change it.')
        ->and($delete['status'])->toBe(403)
        ->and($template->fresh()->name)->toBe('Kick-off');
});

it('[P17b-14] lets a workspace admin who created neither template edit one and delete the other', function () {
    $team = Team::factory()->create();
    $fran = p17bRenamed(teamMember($team), 'Fran Facilitator');
    $ada = p17bRenamed(workspaceManager($team->workspace), 'Ada Admin');
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
        ->assertPathIs(p17bBoardPath($board));

    $this->awaitRealtime($page);
    $this->awaitWhiteboardElements($page, 4);

    expect($this->whiteboardElements($page, $board))->toHaveCount(4)
        ->and($page->script(p17bFileDownload($board)))->toBe('200 image/png '.strlen(base64_decode(P17bPng)));

    $page->click('a[aria-label="Back to the team"]')
        ->click('button:text-is("New whiteboard")')
        ->assertPresent('[role="dialog"] [role="radiogroup"]')
        ->assertCount('[role="dialog"] [role="radiogroup"]', 1)
        ->assertDontSee('Workspace templates');
});
