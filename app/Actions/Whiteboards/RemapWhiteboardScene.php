<?php

namespace App\Actions\Whiteboards;

use Illuminate\Support\Str;

/**
 * Turns the elements of one scene into the first elements of another: fresh
 * ids, fresh stacking indices in the same order, version 1, and every
 * reference between elements rewritten. A reference to an element that is
 * not part of the scene is dropped, never copied.
 */
class RemapWhiteboardScene
{
    private const int IdLength = 20;

    private const int MaxNonce = 2147483647;

    private const array BindingKeys = ['startBinding', 'endBinding'];

    public function __construct(private GenerateFractionalIndexes $generateFractionalIndexes) {}

    /**
     * @param  list<array<string, mixed>>  $elements  sanitized live elements, in canvas order
     * @return list<array<string, mixed>>
     */
    public function handle(array $elements): array
    {
        $ids = [];

        foreach ($elements as $element) {
            $ids[$element['id']] = Str::random(self::IdLength);
        }

        $groups = [];
        $indexes = $this->generateFractionalIndexes->handle(count($elements));
        $updated = now()->getTimestampMs();
        $copies = [];

        foreach ($elements as $position => $element) {
            $copy = [
                ...$element,
                'id' => $ids[$element['id']],
                'index' => $indexes[$position],
                'version' => 1,
                'versionNonce' => random_int(1, self::MaxNonce),
                'updated' => $updated,
                'isDeleted' => false,
            ];

            foreach (['frameId', 'containerId'] as $key) {
                if (array_key_exists($key, $copy)) {
                    $copy[$key] = $ids[$copy[$key]] ?? null;
                }
            }

            foreach (self::BindingKeys as $key) {
                if (array_key_exists($key, $copy)) {
                    $copy[$key] = $this->binding($copy[$key], $ids);
                }
            }

            if (array_key_exists('boundElements', $copy)) {
                $copy['boundElements'] = $this->boundElements($copy['boundElements'], $ids);
            }

            if (array_key_exists('groupIds', $copy)) {
                $copy['groupIds'] = array_map(function (string $groupId) use (&$groups): string {
                    return $groups[$groupId] ??= Str::random(self::IdLength);
                }, $copy['groupIds']);
            }

            $copies[] = $copy;
        }

        return $copies;
    }

    /**
     * @param  array<string, string>  $ids
     * @return array<string, mixed>|null
     */
    private function binding(mixed $binding, array $ids): ?array
    {
        if (! is_array($binding) || ! isset($ids[$binding['elementId']])) {
            return null;
        }

        return [...$binding, 'elementId' => $ids[$binding['elementId']]];
    }

    /**
     * @param  array<string, string>  $ids
     * @return list<array<string, mixed>>|null
     */
    private function boundElements(mixed $boundElements, array $ids): ?array
    {
        if (! is_array($boundElements)) {
            return null;
        }

        $kept = [];

        foreach ($boundElements as $bound) {
            if (isset($ids[$bound['id']])) {
                $kept[] = [...$bound, 'id' => $ids[$bound['id']]];
            }
        }

        return $kept === [] ? null : $kept;
    }
}
