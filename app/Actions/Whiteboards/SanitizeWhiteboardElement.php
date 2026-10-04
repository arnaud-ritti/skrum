<?php

namespace App\Actions\Whiteboards;

class SanitizeWhiteboardElement
{
    public const MaxBytes = 65536;

    public const MaxTextLength = 10000;

    public const IdPattern = '/^[A-Za-z0-9_-]{1,40}$/';

    public const FileIdPattern = '/^[A-Za-z0-9_-]{1,64}$/';

    /**
     * The `version` column is a 32-bit integer on PostgreSQL.
     */
    public const MaxVersion = 2147483647;

    private const string StickyType = 'rectangle';

    private const array BaseKeys = [
        'id', 'type', 'x', 'y', 'width', 'height', 'angle', 'strokeColor', 'backgroundColor',
        'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity', 'groupIds', 'frameId',
        'index', 'roundness', 'seed', 'version', 'versionNonce', 'isDeleted', 'boundElements',
        'updated', 'link', 'locked', 'customData',
    ];

    private const array LinearKeys = [
        'points', 'lastCommittedPoint', 'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead',
    ];

    private const array TypeKeys = [
        'rectangle' => [],
        'diamond' => [],
        'ellipse' => [],
        'arrow' => [...self::LinearKeys, 'elbowed', 'fixedSegments', 'startIsSpecial', 'endIsSpecial'],
        'line' => [...self::LinearKeys],
        'freedraw' => ['points', 'pressures', 'simulatePressure', 'lastCommittedPoint'],
        'text' => [
            'text', 'originalText', 'fontSize', 'fontFamily', 'textAlign', 'verticalAlign',
            'containerId', 'autoResize', 'lineHeight',
        ],
        'image' => ['fileId', 'status', 'scale', 'crop'],
        'frame' => ['name'],
    ];

    private const array TextKeys = ['text', 'originalText'];

    private const array PointTypes = ['arrow', 'line', 'freedraw'];

    private const array StringKeys = [
        'strokeColor', 'backgroundColor', 'fillStyle', 'strokeStyle', 'textAlign', 'verticalAlign', 'status',
    ];

    private const array NumberKeys = [
        'angle', 'strokeWidth', 'roughness', 'opacity', 'seed', 'updated', 'fontSize', 'fontFamily', 'lineHeight',
    ];

    private const array BooleanKeys = ['elbowed', 'simulatePressure', 'autoResize'];

    private const array NullableBooleanKeys = ['startIsSpecial', 'endIsSpecial'];

    private const array NullableStringKeys = ['startArrowhead', 'endArrowhead', 'name'];

    private const array NullableIdKeys = ['frameId', 'containerId'];

    private const array BindingKeys = ['startBinding', 'endBinding'];

    private const array CropKeys = ['x', 'y', 'width', 'height', 'naturalWidth', 'naturalHeight'];

    /**
     * @return array<string, mixed>|null
     */
    public function handle(mixed $raw): ?array
    {
        if (! is_array($raw)) {
            return null;
        }

        $type = $raw['type'] ?? null;

        if (! is_string($type) || ! array_key_exists($type, self::TypeKeys)) {
            return null;
        }

        $element = array_intersect_key($raw, array_flip([...self::BaseKeys, ...self::TypeKeys[$type]]));

        if (! $this->hasValidIdentity($element)) {
            return null;
        }

        if (! $this->hasFiniteNumbers($element)) {
            return null;
        }

        if (! $this->hasValidText($element)) {
            return null;
        }

        if ($type === 'image' && ! $this->hasValidFile($element)) {
            return null;
        }

        if (! $this->hasValidShape($element, $type)) {
            return null;
        }

        $element['isDeleted'] = (bool) ($element['isDeleted'] ?? false);
        $element['locked'] = (bool) ($element['locked'] ?? false);
        $element['link'] = $this->safeLink($element['link'] ?? null);
        $element = $this->withStickyMarkerOnly($element, $type);

        if (strlen((string) json_encode($element)) > self::MaxBytes) {
            return null;
        }

        return $element;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function hasValidIdentity(array $element): bool
    {
        $id = $element['id'] ?? null;

        if (! is_string($id) || preg_match(self::IdPattern, $id) !== 1) {
            return false;
        }

        $version = $element['version'] ?? null;

        if (! is_int($version) || $version < 1 || $version > self::MaxVersion) {
            return false;
        }

        $nonce = $element['versionNonce'] ?? null;

        if (! is_int($nonce) || $nonce < 0) {
            return false;
        }
        return array_all(['x', 'y', 'width', 'height'], fn(string $key): bool => is_int($element[$key] ?? null) || is_float($element[$key] ?? null));
    }

    private function hasFiniteNumbers(mixed $value): bool
    {
        if (is_float($value)) {
            return is_finite($value);
        }

        if (! is_array($value)) {
            return true;
        }
        return array_all($value, fn($item): bool => $this->hasFiniteNumbers($item));
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function hasValidText(array $element): bool
    {
        foreach (self::TextKeys as $key) {
            if (! array_key_exists($key, $element)) {
                continue;
            }

            if (! is_string($element[$key])) {
                return false;
            }

            if (mb_strlen($element[$key]) > self::MaxTextLength) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $element
     */
    private function hasValidFile(array $element): bool
    {
        $fileId = $element['fileId'] ?? null;

        return is_string($fileId) && preg_match(self::FileIdPattern, $fileId) === 1;
    }

    /**
     * Excalidraw reads these keys without checking them when it restores or
     * draws an element, so one element of the wrong shape stops the canvas
     * from loading for everyone on the board.
     *
     * @param  array<string, mixed>  $element
     */
    private function hasValidShape(array $element, string $type): bool
    {
        if (in_array($type, self::PointTypes, true) && ! array_key_exists('points', $element)) {
            return false;
        }

        if ($type === 'text' && ! array_key_exists('text', $element)) {
            return false;
        }
        return array_all($element, fn($value, string $key): bool => $this->hasValidValue($key, $value));
    }

    private function hasValidValue(string $key, mixed $value): bool
    {
        return match (true) {
            in_array($key, self::StringKeys, true) => is_string($value),
            in_array($key, self::NumberKeys, true) => $this->isNumber($value),
            in_array($key, self::BooleanKeys, true) => is_bool($value),
            in_array($key, self::NullableBooleanKeys, true) => $value === null || is_bool($value),
            in_array($key, self::NullableStringKeys, true) => $value === null || is_string($value),
            in_array($key, self::NullableIdKeys, true) => $value === null || $this->isId($value),
            in_array($key, self::BindingKeys, true) => $value === null || $this->isBinding($value),
            $key === 'index' => $value === null || $this->isFractionalIndex($value),
            $key === 'groupIds' => $this->isListOf($value, is_string(...)),
            $key === 'boundElements' => $value === null || $this->isListOf($value, $this->isBoundElement(...)),
            $key === 'points' => $this->isListOf($value, $this->isPoint(...)) && $value !== [],
            $key === 'pressures' => $this->isListOf($value, $this->isNumber(...)),
            $key === 'scale' => $this->isPoint($value),
            $key === 'lastCommittedPoint' => $value === null || $this->isPoint($value),
            $key === 'roundness' => $value === null || $this->isRoundness($value),
            $key === 'crop' => $value === null || $this->isCrop($value),
            $key === 'fixedSegments' => $value === null || $this->isListOf($value, $this->isFixedSegment(...)),
            default => true,
        };
    }

    private function isNumber(mixed $value): bool
    {
        return is_int($value) || (is_float($value) && is_finite($value));
    }

    private function isId(mixed $value): bool
    {
        return is_string($value) && preg_match(self::IdPattern, $value) === 1;
    }

    /**
     * @param  callable(mixed): bool  $accepts
     */
    private function isListOf(mixed $value, callable $accepts): bool
    {
        return is_array($value) && array_is_list($value) && array_all($value, fn (mixed $item): bool => $accepts($item));
    }

    private function isPoint(mixed $value): bool
    {
        return $this->isListOf($value, $this->isNumber(...)) && count($value) === 2;
    }

    private function isBoundElement(mixed $value): bool
    {
        return is_array($value) && $this->isId($value['id'] ?? null) && is_string($value['type'] ?? null);
    }

    private function isBinding(mixed $value): bool
    {
        if (! is_array($value) || ! $this->isId($value['elementId'] ?? null)) {
            return false;
        }

        if (! $this->isNumber($value['focus'] ?? 0) || ! $this->isNumber($value['gap'] ?? 0)) {
            return false;
        }

        return ! isset($value['fixedPoint']) || $this->isPoint($value['fixedPoint']);
    }

    private function isRoundness(mixed $value): bool
    {
        return is_array($value) && $this->isNumber($value['type'] ?? null) && $this->isNumber($value['value'] ?? 0);
    }

    private function isCrop(mixed $value): bool
    {
        return is_array($value) && array_all(self::CropKeys, fn (string $key): bool => $this->isNumber($value[$key] ?? null));
    }

    private function isFixedSegment(mixed $value): bool
    {
        return is_array($value)
            && $this->isPoint($value['start'] ?? null)
            && $this->isPoint($value['end'] ?? null)
            && is_int($value['index'] ?? null);
    }

    /**
     * The rules of the `fractional-indexing` package Excalidraw orders its
     * elements with; it throws on a key that breaks them.
     */
    private function isFractionalIndex(mixed $value): bool
    {
        if (! is_string($value) || preg_match('/^[A-Za-z][0-9A-Za-z]*\z/', $value) !== 1) {
            return false;
        }

        $integerLength = $value[0] >= 'a'
            ? ord($value[0]) - ord('a') + 2
            : ord('Z') - ord($value[0]) + 2;

        if (strlen($value) < $integerLength) {
            return false;
        }

        if ($value === 'A'.str_repeat('0', 26)) {
            return false;
        }

        return strlen($value) === $integerLength || ! str_ends_with($value, '0');
    }

    private function safeLink(mixed $link): ?string
    {
        if (! is_string($link)) {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $link) !== 1) {
            return null;
        }

        return $link;
    }

    /**
     * @param  array<string, mixed>  $element
     * @return array<string, mixed>
     */
    private function withStickyMarkerOnly(array $element, string $type): array
    {
        $kind = is_array($element['customData'] ?? null)
            ? ($element['customData']['skrum']['kind'] ?? null)
            : null;

        unset($element['customData']);

        if ($type !== self::StickyType || $kind !== 'sticky') {
            return $element;
        }

        return [...$element, 'customData' => ['skrum' => ['kind' => 'sticky']]];
    }
}
