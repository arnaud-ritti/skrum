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
    case AvatarStyle = 'avatar_style';
    case AvatarMemberChoice = 'avatar_member_choice';
    case GifProvider = 'gif_provider';
    case GifEnabled = 'gif_enabled';
    case GifRating = 'gif_rating';
    case GifKey = 'gif_key';
}
