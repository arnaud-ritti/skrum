<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstanceSettingKey;

class LlmSettingsUpdateRequest extends InstanceConfigurationUpdateRequest
{
    public function section(): InstanceSettingKey
    {
        return InstanceSettingKey::Llm;
    }
}
