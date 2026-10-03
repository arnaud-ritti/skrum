<?php

namespace App\Http\Requests\Admin;

use App\Enums\InstanceSettingKey;
use App\Enums\IntegrationProvider;
use App\Support\InstanceConfiguration\ConfigurationCatalogue;

class IntegrationAppUpdateRequest extends InstanceConfigurationUpdateRequest
{
    public function section(): InstanceSettingKey
    {
        return resolve(ConfigurationCatalogue::class)->section($this->provider());
    }

    public function provider(): IntegrationProvider
    {
        return IntegrationProvider::from((string) $this->route('provider'));
    }
}
