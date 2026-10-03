<?php

namespace App\Listeners;

use App\Support\Maintenance\MaintenanceDetails;
use Illuminate\Foundation\Events\MaintenanceModeEnabled;

class AddMaintenanceDetailsListener
{
    public function __construct(private MaintenanceDetails $maintenanceDetails) {}

    public function handle(MaintenanceModeEnabled $event): void
    {
        rescue(function (): void {
            $maintenanceMode = app()->maintenanceMode();

            $maintenanceMode->activate($this->maintenanceDetails->attachTo($maintenanceMode->data()));
        });
    }
}
