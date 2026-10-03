<?php

namespace App\Support\Poker;

use App\Support\Alphabetical;

/**
 * Spec plan 22 §6.5, rules AC-1 to AC-7 (owner, decision 6, B): the
 * criteria are the description's section under an "Acceptance criteria"
 * heading. The owner accepted that another wording or heading style splits
 * nothing (AC-7): do not widen these rules without the owner.
 */
class AcceptanceCriteriaSection
{
    /** Folded heading texts. English only: spec §16.8, ruled from the owner's answers of 2026-10-03. */
    public const array Headings = ['acceptance criteria'];

    private const string AtxHeading = '/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/u';

    private const string BoldLine = '/^[ \t]*(\*\*|__)((?:(?!\1).)+)\1:?[ \t]*$/u';

    private const string ColonLine = '/^[ \t]*(\p{L}[\p{L} \t\'’-]*):[ \t]*$/u';

    private const string Fence = '/^ {0,3}(`{3,}|~{3,})/u';

    /**
     * @return array{description: ?string, criteria: ?string}
     */
    public static function split(?string $markdown): array
    {
        $unchanged = ['description' => trim((string) $markdown) === '' ? null : $markdown, 'criteria' => null];

        if ($unchanged['description'] === null) {
            return $unchanged;
        }

        $lines = preg_split('/\R/u', (string) $markdown) ?: [];
        $start = null;
        $level = 0;
        $end = count($lines);
        $openFence = null;

        foreach ($lines as $index => $line) {
            if (preg_match(self::Fence, $line, $fence) === 1) {
                $openFence = self::fenceAfter($openFence, $fence[1]);

                continue;
            }

            if ($openFence !== null) {
                continue;
            }

            if ($start === null) {
                $headingLevel = self::criteriaHeadingLevel($line);

                if ($headingLevel !== null) {
                    $start = $index;
                    $level = $headingLevel;
                }

                continue;
            }

            if (self::endsSection($line, $level)) {
                $end = $index;

                break;
            }
        }

        if ($start === null) {
            return $unchanged;
        }

        $criteria = self::text(array_slice($lines, $start + 1, $end - $start - 1));

        if ($criteria === null) {
            return $unchanged;
        }

        $parts = array_values(array_filter(
            [self::text(array_slice($lines, 0, $start)), self::text(array_slice($lines, $end))],
            fn (?string $part): bool => $part !== null,
        ));

        return ['description' => $parts === [] ? null : implode("\n\n", $parts), 'criteria' => $criteria];
    }

    /**
     * A fence closes only with the character that opened it, at least as long.
     */
    private static function fenceAfter(?string $openFence, string $marker): ?string
    {
        if ($openFence === null) {
            return $marker;
        }

        if ($marker[0] === $openFence[0] && strlen($marker) >= strlen($openFence)) {
            return null;
        }

        return $openFence;
    }

    /**
     * 1 to 6 for an ATX heading, 0 for a bold or a colon line, null when the
     * line is not the criteria heading.
     */
    private static function criteriaHeadingLevel(string $line): ?int
    {
        if (preg_match(self::AtxHeading, $line, $match) === 1) {
            return self::isCriteria($match[2] ?? '') ? strlen($match[1]) : null;
        }

        if (preg_match(self::BoldLine, $line, $match) === 1) {
            return self::isCriteria($match[2]) ? 0 : null;
        }

        if (preg_match(self::ColonLine, $line, $match) === 1) {
            return self::isCriteria($match[1]) ? 0 : null;
        }

        return null;
    }

    private static function endsSection(string $line, int $level): bool
    {
        if (self::criteriaHeadingLevel($line) !== null) {
            return false;
        }

        if (preg_match(self::AtxHeading, $line, $match) === 1) {
            return $level === 0 || strlen($match[1]) <= $level;
        }

        return $level === 0 && preg_match(self::BoldLine, $line) === 1;
    }

    private static function isCriteria(string $text): bool
    {
        $words = preg_replace('/\s+/u', ' ', trim(preg_replace('/:$/u', '', trim($text)) ?? ''));

        return in_array(Alphabetical::key((string) $words), self::Headings, true);
    }

    /**
     * @param  list<string>  $lines
     */
    private static function text(array $lines): ?string
    {
        $text = trim(implode("\n", $lines));

        return $text === '' ? null : $text;
    }
}
