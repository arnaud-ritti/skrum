<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstanceSettingKey;
use App\Enums\SsoProvider;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;

class SsoProviderUpdateRequest extends InstanceConfigurationUpdateRequest
{
    public function section(): InstanceSettingKey
    {
        return resolve(ConfigurationCatalogue::class)->section($this->provider());
    }

    public function provider(): SsoProvider
    {
        return SsoProvider::from((string) $this->route('provider'));
    }
}
