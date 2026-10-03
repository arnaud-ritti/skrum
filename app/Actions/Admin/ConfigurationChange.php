<?php

namespace App\Actions\Admin;

class ConfigurationChange
{
    /**
     * @param  array<int, string>  $changed  names of the fields written
     * @param  array<int, string>  $cleared  names of the fields returned to the environment
     * @param  bool  $alerted  whether a change of this section mails the instance admins (SSO, SMTP)
     * @param  ?bool  $alertSent  null when no alert is due
     */
    public function __construct(
        public array $changed,
        public array $cleared,
        public bool $alerted,
        public ?bool $alertSent = null,
    ) {}

    public function isEmpty(): bool
    {
        return $this->changed === [] && $this->cleared === [];
    }
}
