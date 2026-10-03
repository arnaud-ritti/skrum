<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstanceSettingKey;

class MailSettingsUpdateRequest extends InstanceConfigurationUpdateRequest
{
    public function section(): InstanceSettingKey
    {
        return InstanceSettingKey::Smtp;
    }
}
