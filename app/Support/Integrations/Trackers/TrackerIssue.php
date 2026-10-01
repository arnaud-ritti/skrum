<?php

namespace App\Support\Integrations\Trackers;

class TrackerIssue
{
    public const TitleLength = 200;

    public const AssigneeLength = 100;

    public const EstimateLength = 16;

    public function __construct(
        public string $externalId,
        public string $key,
        public string $title,
        public ?string $description,
        public string $url,
        public ?string $assignee,
        public ?string $estimate,
        public ?string $status,
        public ?IssueStatus $issueStatus = null,
    ) {}

    /**
     * The issue as a confirmed write left it, when the source cannot be
     * read back right away.
     */
    public function withStatus(IssueStatus $issueStatus, ?string $status): self
    {
        $moved = clone $this;
        $moved->issueStatus = $issueStatus;
        $moved->status = $status;

        return $moved;
    }

    public static function title(mixed $value, string $fallback): string
    {
        $title = is_string($value) ? trim($value) : '';

        return mb_substr($title === '' ? $fallback : $title, 0, self::TitleLength);
    }

    public static function formatEstimate(mixed $value): ?string
    {
        if (! is_int($value) && ! is_float($value)) {
            return null;
        }

        $formatted = rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.');

        return mb_substr($formatted === '-0' ? '0' : $formatted, 0, self::EstimateLength);
    }

    public static function shorten(mixed $value, int $length): ?string
    {
        if (! is_string($value) || trim($value) === '') {
            return null;
        }

        return mb_substr(trim($value), 0, $length);
    }

    /**
     * @return array{
     *     externalId: string,
     *     key: string,
     *     title: string,
     *     assignee: ?string,
     *     estimate: ?string,
     *     status: ?string,
     *     alreadyImported: bool
     * }
     */
    public function preview(bool $alreadyImported): array
    {
        return [
            'externalId' => $this->externalId,
            'key' => $this->key,
            'title' => $this->title,
            'assignee' => $this->assignee,
            'estimate' => $this->estimate,
            'status' => $this->status,
            'alreadyImported' => $alreadyImported,
        ];
    }
}
