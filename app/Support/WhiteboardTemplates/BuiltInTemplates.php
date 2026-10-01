<?php

namespace App\Support\WhiteboardTemplates;

use Illuminate\Support\Facades\File;

/**
 * The built-in scenes of `resources/whiteboard-templates`. A file lists its
 * elements back to front with only the keys that differ from the defaults
 * below; `text` and a frame's `name` hold the last segment of a line of
 * `lang/{locale}/whiteboards.php`.
 */
class BuiltInTemplates
{
    public const Blank = 'blank';

    public const Keys = ['blank', 'brainstorm', 'flowchart', 'user_story_map', 'impact_map', 'swot', 'lean_canvas', 'matrix'];

    /**
     * The canvas does not measure text it is handed, and draws it on a
     * surface of the stored size plus half a font size on each side. The
     * hand-drawn font averages about half its size per character.
     */
    public const CharacterWidth = 0.6;

    private const Base = [
        'angle' => 0,
        'strokeColor' => '#1e1e1e',
        'backgroundColor' => 'transparent',
        'fillStyle' => 'solid',
        'strokeWidth' => 2,
        'strokeStyle' => 'solid',
        'roughness' => 0,
        'opacity' => 100,
        'groupIds' => [],
        'frameId' => null,
        'index' => null,
        'roundness' => null,
        'version' => 1,
        'versionNonce' => 1,
        'isDeleted' => false,
        'boundElements' => null,
        'updated' => 1,
        'link' => null,
        'locked' => false,
    ];

    private const Linear = [
        'lastCommittedPoint' => null,
        'startBinding' => null,
        'endBinding' => null,
        'startArrowhead' => null,
        'endArrowhead' => null,
    ];

    private const ByType = [
        'text' => [
            'fontSize' => 20,
            'fontFamily' => 5,
            'textAlign' => 'left',
            'verticalAlign' => 'top',
            'containerId' => null,
            'autoResize' => true,
            'lineHeight' => 1.25,
        ],
        'arrow' => [...self::Linear, 'endArrowhead' => 'arrow', 'elbowed' => false],
        'line' => self::Linear,
        'frame' => ['name' => null],
    ];

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return self::Keys;
    }

    public function name(string $key): string
    {
        return $this->line("whiteboards.{$key}.name");
    }

    public function description(string $key): string
    {
        return $this->line("whiteboards.{$key}.description");
    }

    /**
     * The scene in the current locale, back to front.
     *
     * @return list<array<string, mixed>>
     */
    public function elements(string $key): array
    {
        $elements = [];

        foreach ($this->read($key) as $raw) {
            $elements[$raw['id']] = [
                ...self::Base,
                ...(self::ByType[$raw['type']] ?? []),
                'seed' => crc32("{$key}:{$raw['id']}") % 2147483647,
                ...$raw,
            ];
        }

        foreach ($elements as $id => $element) {
            $elements[$id] = match ($element['type']) {
                'text' => $this->text($key, $element, $elements[$element['containerId']] ?? null),
                'frame' => [...$element, 'name' => $this->line("whiteboards.{$key}.texts.{$element['name']}")],
                'arrow', 'line' => [...$element, ...$this->extent($element['points'])],
                default => $element,
            };
        }

        foreach ($elements as $id => $element) {
            if (($element['containerId'] ?? null) !== null) {
                $elements[$element['containerId']]['boundElements'][] = ['id' => $id, 'type' => 'text'];
            }

            foreach (['startBinding', 'endBinding'] as $end) {
                if (($element[$end] ?? null) !== null) {
                    $elements[$element[$end]['elementId']]['boundElements'][] = ['id' => $id, 'type' => 'arrow'];
                }
            }
        }

        return array_values($elements);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function read(string $key): array
    {
        abort_unless(in_array($key, self::Keys, true), 404);

        /** @var array{elements: list<array<string, mixed>>} $scene */
        $scene = json_decode(File::get(resource_path("whiteboard-templates/{$key}.json")), true, flags: JSON_THROW_ON_ERROR);

        return $scene['elements'];
    }

    /**
     * A text in a shape is centred in it and belongs to the shape's frame.
     *
     * @param  array<string, mixed>  $element
     * @param  array<string, mixed>|null  $container
     * @return array<string, mixed>
     */
    private function text(string $key, array $element, ?array $container): array
    {
        $text = $this->line("whiteboards.{$key}.texts.{$element['text']}");
        $lines = explode("\n", $text);
        $width = (int) ceil(max(array_map(mb_strlen(...), $lines)) * $element['fontSize'] * self::CharacterWidth);
        $height = (int) ceil(count($lines) * $element['fontSize'] * $element['lineHeight']);

        $element = [...$element, 'text' => $text, 'originalText' => $text, 'width' => $width, 'height' => $height];

        if ($container === null) {
            return $element;
        }

        return [
            ...$element,
            'x' => $container['x'] + ($container['width'] - $width) / 2,
            'y' => $container['y'] + ($container['height'] - $height) / 2,
            'textAlign' => 'center',
            'verticalAlign' => 'middle',
            'frameId' => $container['frameId'],
        ];
    }

    /**
     * @param  non-empty-list<array{0: int|float, 1: int|float}>  $points
     * @return array{width: int|float, height: int|float}
     */
    private function extent(array $points): array
    {
        $xs = array_column($points, 0);
        $ys = array_column($points, 1);

        return ['width' => max($xs) - min($xs), 'height' => max($ys) - min($ys)];
    }

    private function line(string $key): string
    {
        $line = __($key);

        return is_string($line) ? $line : $key;
    }
}
