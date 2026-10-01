<?php

namespace App\Exceptions\Integrations;

use RuntimeException;

/**
 * An OAuth callback that reached the provider but cannot become a
 * connection; the message is translated and shown to the admin as is.
 */
class ConnectionRefused extends RuntimeException {}
