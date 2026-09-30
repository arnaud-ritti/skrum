<?php

namespace App\Contracts;

use App\Models\Team;

/**
 * A model an integration delivery can be about: its team owns the
 * connection used, and it tells its viewers when a delivery changed.
 */
interface DeliverySubject
{
    public function deliveryTeam(): Team;

    public function announceDeliveryChange(): void;
}
