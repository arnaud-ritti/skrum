<?php

namespace App\Enums;

enum InstanceSettingKey: string
{
    case BrandColor = 'brand_color';
    case BrandRadius = 'brand_radius';
    case DisplayName = 'display_name';
    case PoweredBy = 'powered_by';
    case LogoLight = 'logo_light';
    case LogoDark = 'logo_dark';
    case Favicon = 'favicon';
    case LogoMail = 'logo_mail';
    case AvatarStyle = 'avatar_style';
    case AvatarMemberChoice = 'avatar_member_choice';
    case GifProvider = 'gif_provider';
    case GifEnabled = 'gif_enabled';
    case GifRating = 'gif_rating';
    case GifKey = 'gif_key';
    case SsoRequired = 'sso_required';

    /**
     * The keys the Branding screen owns, and the only ones its reset clears.
     *
     * @return array<int, self>
     */
    public static function branding(): array
    {
        return array_values(array_filter(self::cases(), fn (self $key): bool => $key !== self::SsoRequired));
    }
}
