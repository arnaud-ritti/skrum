<?php

namespace App\Support\InstanceConfiguration;

use App\Enums\ConfigurationFieldKind;

class ConfigurationField
{
    /**
     * @param  array<int, string>  $configKeys  every configuration key the value is written to
     * @param  array<int, string>  $clearsWhenStored  configuration keys set to null while this field is stored
     */
    public function __construct(
        public string $name,
        public array $configKeys,
        public string $envName,
        public ConfigurationFieldKind $kind = ConfigurationFieldKind::Text,
        public array $clearsWhenStored = [],
    ) {}
}
