<?php

namespace App\Support\Integrations\Messages;

/**
 * A message built once, in the sharer's locale, when a share is requested.
 */
interface ShareContent
{
    /**
     * @return array<string, mixed>
     */
    public function toSlack(): array;

    public function toTelegram(): string;

    /**
     * @return array<string, mixed>
     */
    public function toMicrosoftTeams(): array;

    public function toMattermost(): string;
}
