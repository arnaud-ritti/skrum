<?php

namespace App\Exceptions\Integrations;

use RuntimeException;

/**
 * The source refuses this estimate for a reason retrying cannot fix; the
 * message is translated and shown on the task.
 */
class EstimateRejected extends RuntimeException {}
