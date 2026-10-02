<?php

namespace App\Support\Avatars;

use App\Support\InstanceSettings;
use Closure;

class AvatarUrl
{
    public const string DefaultStyle = 'thumbs';

    public function __construct(
        private InstanceSettings $settings,
        private AvatarStyleCatalogue $catalogue,
    ) {}

    /**
     * The style of the environment, which the unversioned avatar address has always rendered.
     */
    public function environmentStyle(): string
    {
        $configured = config('skrum.avatar_style');

        if (! is_string($configured)) {
            return self::DefaultStyle;
        }

        if ($this->catalogue->path($configured) === null) {
            return self::DefaultStyle;
        }

        return $configured;
    }

    public function instanceStyle(): string
    {
        $style = $this->settings->avatarStyle();

        if (! $this->catalogue->isSelectable($style)) {
            return $this->environmentStyle();
        }

        return $style;
    }

    public function styleFor(?string $memberStyle): string
    {
        if ($memberStyle === null) {
            return $this->instanceStyle();
        }

        if (! $this->settings->avatarMemberChoice()) {
            return $this->instanceStyle();
        }

        if (! $this->catalogue->isSelectable($memberStyle)) {
            return $this->instanceStyle();
        }

        return $memberStyle;
    }

    /**
     * The closures are only called when their answer is needed, so a guest identity does not load its user for nothing.
     *
     * @param  Closure(): ?string  $memberStyle
     * @param  Closure(): string  $name
     */
    public function for(string $seed, Closure $memberStyle, Closure $name): string
    {
        $style = $this->settings->avatarMemberChoice()
            ? $this->styleFor($memberStyle())
            : $this->instanceStyle();

        return $this->url($style, $seed, $name);
    }

    /**
     * The address carries the style whenever it differs from the environment's, because avatars are cached as immutable.
     *
     * @param  Closure(): string  $name
     */
    public function url(string $style, string $seed, Closure $name): string
    {
        if ($style === AvatarStyleCatalogue::Initials) {
            return route('styledAvatars.show', ['style' => $style, 'seed' => $seed, 'n' => $this->initials($name())], absolute: false);
        }

        if ($style === $this->environmentStyle()) {
            return route('avatars.show', $seed, absolute: false);
        }

        return route('styledAvatars.show', ['style' => $style, 'seed' => $seed], absolute: false);
    }

    public function initials(string $name): string
    {
        $words = preg_split('/\s+/u', trim($name), flags: PREG_SPLIT_NO_EMPTY) ?: [];
        $letters = array_map(fn (string $word): string => mb_substr($word, 0, 1), $words);

        if ($letters === []) {
            return '';
        }

        if (count($letters) === 1) {
            return mb_strtoupper($letters[0]);
        }

        return mb_strtoupper($letters[0].$letters[count($letters) - 1]);
    }
}
