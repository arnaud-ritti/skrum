<?php

namespace App\Support\Branding;

use App\Support\InstanceSettings;

class BrandStyle
{
    public const int DefaultRadiusPx = 10;

    public function __construct(private InstanceSettings $settings) {}

    /**
     * The overrides of the stylesheet tokens, or null when the instance keeps the default look.
     *
     * Every value comes out of a number: BrandPalette prints floats, the radius is a clamped integer.
     */
    public function css(): ?string
    {
        $color = $this->settings->brandColor();
        $radius = $this->settings->brandRadius();

        if ($color !== null) {
            return BrandPalette::derive($color, $radius ?? self::DefaultRadiusPx)->css();
        }

        if ($radius === null) {
            return null;
        }

        $rem = $radius / 16;

        return ":root {\n  --radius: {$rem}rem;\n}\n";
    }
}
