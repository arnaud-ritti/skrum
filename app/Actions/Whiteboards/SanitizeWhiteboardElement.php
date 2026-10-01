<?php

namespace App\Actions\Whiteboards;

class SanitizeWhiteboardElement
{
    public const MaxBytes = 65536;

    public const MaxTextLength = 10000;

    public const IdPattern = '/^[A-Za-z0-9_-]{1,40}$/';

    public const FileIdPattern = '/^[A-Za-z0-9_-]{1,64}$/';

    private const StickyType = 'rectangle';

    private const BaseKeys = [
        'id', 'type', 'x', 'y', 'width', 'height', 'angle', 'strokeColor', 'backgroundColor',
        'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity', 'groupIds', 'frameId',
        'index', 'roundness', 'seed', 'version', 'versionNonce', 'isDeleted', 'boundElements',
        'updated', 'link', 'locked', 'customData',
    ];

    private const LinearKeys = [
        'points', 'lastCommittedPoint', 'startBinding', 'endBinding', 'startArrowhead', 'endArrowhead',
    ];

    private const TypeKeys = [
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

    private const TextKeys = ['text', 'originalText'];

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

        if (! is_int($version) || $version < 1) {
            return false;
        }

        $nonce = $element['versionNonce'] ?? null;

        if (! is_int($nonce) || $nonce < 0) {
            return false;
        }

        foreach (['x', 'y', 'width', 'height'] as $key) {
            if (! is_int($element[$key] ?? null) && ! is_float($element[$key] ?? null)) {
                return false;
            }
        }

        return true;
    }

    private function hasFiniteNumbers(mixed $value): bool
    {
        if (is_float($value)) {
            return is_finite($value);
        }

        if (! is_array($value)) {
            return true;
        }

        foreach ($value as $item) {
            if (! $this->hasFiniteNumbers($item)) {
                return false;
            }
        }

        return true;
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
