<?php

namespace App\Support\Integrations\Messages;

use Illuminate\Support\Str;

class LinkShareContent implements ShareContent
{
    private const TextLimit = 2900;

    public function __construct(
        public string $text,
        public string $buttonLabel,
        public string $url,
    ) {}

    public function toSlack(): array
    {
        $text = SlackText::escape(Str::limit($this->text, self::TextLimit, '…'));

        return [
            'text' => $text,
            'blocks' => [
                ['type' => 'section', 'text' => ['type' => 'mrkdwn', 'text' => $text]],
                ['type' => 'actions', 'elements' => [[
                    'type' => 'button',
                    'text' => ['type' => 'plain_text', 'text' => Str::limit($this->buttonLabel, SlackText::ButtonLimit - 1, '…')],
                    'url' => $this->url,
                ]]],
            ],
        ];
    }

    public function toTelegram(): string
    {
        $text = TelegramText::escape(Str::limit($this->text, self::TextLimit, '…'));
        $url = TelegramText::escape($this->url);
        $label = TelegramText::escape($this->buttonLabel);

        return "{$text}\n\n<a href=\"{$url}\">{$label}</a>";
    }

    public function toMicrosoftTeams(): array
    {
        return MicrosoftTeamsText::message(
            [MicrosoftTeamsText::block(Str::limit($this->text, self::TextLimit, '…'))],
            MicrosoftTeamsText::openUrl($this->buttonLabel, $this->url),
        );
    }

    public function toMattermost(): string
    {
        return MattermostText::escape(Str::limit($this->text, self::TextLimit, '…'))
            ."\n\n".MattermostText::link($this->buttonLabel, $this->url);
    }
}
