<?php

use App\Enums\InstanceSettingKey;

it('lists the branding keys explicitly, without the keys of the other sections', function () {
    expect(array_map(fn (InstanceSettingKey $key): string => $key->value, InstanceSettingKey::branding()))->toBe([
        'brand_color', 'brand_radius', 'display_name', 'powered_by', 'logo_light', 'logo_dark', 'favicon',
        'logo_mail', 'avatar_style', 'avatar_member_choice', 'gif_provider', 'gif_enabled', 'gif_rating', 'gif_key',
    ]);
});
