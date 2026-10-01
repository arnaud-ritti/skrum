<?php

namespace App\Support\Integrations\Messages;

/**
 * Adaptive Card 1.4 messages for a Teams Workflows webhook. Mentions need
 * explicit entities, which skrum never sends, so escaping Markdown is enough.
 */
class MicrosoftTeamsText
{
    public const PayloadLimitBytes = 28000;

    private const string Specials = '\\*_[]()#>~`';

    public static function escape(string $text): string
    {
        return MarkdownText::escape($text, self::Specials);
    }

    /**
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public static function block(string $text, array $options = []): array
    {
        return ['type' => 'TextBlock', 'text' => self::escape($text), 'wrap' => true, ...$options];
    }

    /**
     * @return array{type: string, title: string, url: string}
     */
    public static function openUrl(string $title, string $url): array
    {
        return ['type' => 'Action.OpenUrl', 'title' => $title, 'url' => $url];
    }

    /**
     * @param  array<int, array<string, mixed>>  $body
     * @param  array{type: string, title: string, url: string}|null  $action
     * @return array<string, mixed>
     */
    public static function message(array $body, ?array $action = null): array
    {
        $card = [
            '$schema' => 'http://adaptivecards.io/schemas/adaptive-card.json',
            'type' => 'AdaptiveCard',
            'version' => '1.4',
            'body' => $body,
        ];

        if ($action !== null) {
            $card['actions'] = [$action];
        }

        return [
            'type' => 'message',
            'attachments' => [[
                'contentType' => 'application/vnd.microsoft.card.adaptive',
                'content' => $card,
            ]],
        ];
    }

    /**
     * @param  array<string, mixed>  $message
     */
    public static function fits(array $message): bool
    {
        $json = json_encode($message);

        return $json !== false && strlen($json) <= self::PayloadLimitBytes;
    }
}
