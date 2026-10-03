<?php

namespace App\Exceptions;

use InvalidArgumentException;

/**
 * An invitation or an invite link that was answered, revoked, turned off or
 * that expired between the page and the request.
 */
class InvitationUnavailable extends InvalidArgumentException {}
