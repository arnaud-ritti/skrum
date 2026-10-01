<?php

use App\Actions\Whiteboards\SanitizeWhiteboardElement;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Support\WhiteboardTemplates\BuiltInTemplates;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;

const TemplateLocales = ['en', 'fr', 'de', 'es'];

const FilledTemplates = ['brainstorm', 'flowchart', 'user_story_map', 'impact_map', 'swot', 'lean_canvas', 'matrix'];

/**
 * @return array<string, array<string, mixed>>
 */
function builtInScene(string $key, string $locale = 'en'): array
{
    app()->setLocale($locale);

    return collect(app(BuiltInTemplates::class)->elements($key))->keyBy('id')->all();
}

/**
 * The width a shape leaves to the text bound to it, as the canvas computes it.
 *
 * @param  array<string, mixed>  $container
 */
function usableTextWidth(array $container): float
{
    return match ($container['type']) {
        'ellipse' => $container['width'] * 0.7071 - 10,
        'diamond' => $container['width'] / 2 - 10,
        default => $container['width'] - 10,
    };
}

it('offers the eight templates of the spec, each with a file', function () {
    expect(BuiltInTemplates::keys())->toBe(['blank', 'brainstorm', 'flowchart', 'user_story_map', 'impact_map', 'swot', 'lean_canvas', 'matrix']);

    foreach (BuiltInTemplates::keys() as $key) {
        expect(File::exists(resource_path("whiteboard-templates/{$key}.json")))->toBeTrue();
    }

    expect(builtInScene('blank'))->toBe([]);
});

it('builds scenes the board accepts as they are', function (string $key) {
    $sanitize = app(SanitizeWhiteboardElement::class);
    $elements = app(BuiltInTemplates::class)->elements($key);

    expect(array_unique(array_column($elements, 'id')))->toHaveCount(count($elements));

    foreach ($elements as $element) {
        expect($sanitize->handle($element))->toEqual($element);
    }
})->with(BuiltInTemplates::Keys);

it('only refers to elements of the same scene, in both directions', function (string $key) {
    $scene = builtInScene($key);

    foreach ($scene as $id => $element) {
        if ($element['frameId'] !== null) {
            expect($scene[$element['frameId']]['type'])->toBe('frame');
        }

        if (($element['containerId'] ?? null) !== null) {
            expect($scene[$element['containerId']]['boundElements'])->toContain(['id' => $id, 'type' => 'text'])
                ->and($element['frameId'])->toBe($scene[$element['containerId']]['frameId']);
        }

        foreach (['startBinding', 'endBinding'] as $end) {
            if (($element[$end] ?? null) !== null) {
                expect($scene[$element[$end]['elementId']]['boundElements'])->toContain(['id' => $id, 'type' => 'arrow']);
            }
        }

        foreach ($element['boundElements'] ?? [] as $bound) {
            expect($scene)->toHaveKey($bound['id']);
        }
    }
})->with(FilledTemplates);

it('puts the children of a frame below it', function (string $key) {
    $positions = array_flip(array_keys(builtInScene($key)));

    foreach (builtInScene($key) as $id => $element) {
        if ($element['frameId'] !== null) {
            expect($positions[$id])->toBeLessThan($positions[$element['frameId']]);
        }
    }
})->with(FilledTemplates);

it('locks the structure and leaves the sample notes free', function (string $key) {
    $scene = builtInScene($key);
    $stickyIds = collect($scene)->filter(fn (array $element): bool => isset($element['customData']))->keys();

    expect(collect($scene)->where('locked', true))->not->toBeEmpty();

    foreach ($scene as $element) {
        if ($element['type'] === 'frame') {
            expect($element['locked'])->toBeTrue();
        }

        if (isset($element['customData']) || $stickyIds->contains($element['containerId'] ?? null)) {
            expect($element['locked'])->toBeFalse();
        }
    }
})->with(FilledTemplates);

it('has every template line in every locale', function (string $locale) {
    $english = array_keys(Arr::dot(require lang_path('en/whiteboards.php')));
    $translated = array_keys(Arr::dot(require lang_path("{$locale}/whiteboards.php")));

    expect(array_values(array_diff($english, $translated)))->toBe([])
        ->and(array_values(array_diff($translated, $english)))->toBe([]);
})->with(['fr', 'de', 'es']);

it('translates the name, the description and every text of a scene', function (string $key, string $locale) {
    $templates = app(BuiltInTemplates::class);
    app()->setLocale($locale);

    expect($templates->name($key))->not->toStartWith('whiteboards.')
        ->and($templates->description($key))->not->toStartWith('whiteboards.');

    foreach ($templates->elements($key) as $element) {
        $text = $element['type'] === 'frame' ? $element['name'] : ($element['text'] ?? '');

        expect($text)->not->toStartWith('whiteboards.');

        if ($element['type'] === 'text') {
            expect($element['originalText'])->toBe($element['text'])
                ->and($element['width'])->toBeGreaterThan(0)
                ->and($element['height'])->toBeGreaterThan(0);
        }
    }
})->with(BuiltInTemplates::Keys)->with(TemplateLocales);

it('keeps every label inside its shape in every locale', function (string $key, string $locale) {
    $scene = builtInScene($key, $locale);

    foreach ($scene as $element) {
        if (($element['containerId'] ?? null) === null) {
            continue;
        }

        $container = $scene[$element['containerId']];

        expect($element['width'])->toBeLessThanOrEqual(usableTextWidth($container), "{$key}/{$locale}: {$element['text']}")
            ->and($element['height'])->toBeLessThanOrEqual($container['height'] - 10)
            ->and($element['x'] + $element['width'] / 2)->toEqual($container['x'] + $container['width'] / 2)
            ->and($element['y'] + $element['height'] / 2)->toEqual($container['y'] + $container['height'] / 2);
    }
})->with(FilledTemplates)->with(TemplateLocales);

it('creates a board from a template in the language of its creator', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->forceFill(['locale' => 'fr'])->save();

    $this->actingAs($user)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Analyse', 'template' => 'swot'])
        ->assertRedirect();

    $board = Whiteboard::query()->sole();
    $elements = $board->elements()->orderBy('seq')->get();
    $frames = $elements->where('type', 'frame');
    $notes = $elements->where('is_sticky', true);

    expect($frames->map(fn (WhiteboardElement $frame) => $frame->data['name'])->values()->all())
        ->toBe(['Forces', 'Faiblesses', 'Opportunités', 'Menaces'])
        ->and($frames->every(fn (WhiteboardElement $frame) => $frame->data['locked']))->toBeTrue()
        ->and($notes)->toHaveCount(4)
        ->and($notes->every(fn (WhiteboardElement $note) => ! $note->data['locked']))->toBeTrue()
        ->and($elements->firstWhere('type', 'text')->data['text'])->toBe("Que faisons-nous\nbien ?")
        ->and($elements->pluck('author_member_id')->unique()->all())->toBe([$board->facilitator_member_id])
        ->and($elements->pluck('element_id')->intersect(['strengths', 'strength-note'])->all())->toBe([])
        ->and($board->seq)->toBe($elements->count())
        ->and($elements->count())->toBe(12);
});

it('creates each template for a member and serves it back unchanged', function (string $key) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Board', 'template' => $key])
        ->assertRedirect();

    $board = Whiteboard::query()->sole();
    $stored = $board->elements()->orderBy('seq')->get()->map(fn (WhiteboardElement $element) => $element->data)->all();

    $this->actingAs($user)
        ->getJson(route('whiteboards.snapshot.show', $board))
        ->assertOk()
        ->assertJsonPath('elements', $stored);

    expect(count($stored))->toBe(count(app(BuiltInTemplates::class)->elements($key)));
})->with(BuiltInTemplates::Keys);

it('creates an empty board without a template or with the blank one', function (array $extra) {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Empty', ...$extra])
        ->assertRedirect();

    expect(Whiteboard::query()->sole()->elements()->count())->toBe(0);
})->with(['no template' => [[]], 'null' => [['template' => null]], 'blank' => [['template' => 'blank']]]);

it('refuses a template that does not exist', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->post(route('teams.whiteboards.store', [$team->workspace, $team]), ['title' => 'Nope', 'template' => '../../.env'])
        ->assertSessionHasErrors('template');

    expect(Whiteboard::query()->count())->toBe(0);
});
