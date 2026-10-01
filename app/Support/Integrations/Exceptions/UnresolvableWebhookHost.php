<?php

namespace App\Support\Integrations\Exceptions;

/**
 * The host gave no address: a missing record at save time, but just as
 * likely a resolver outage when a delivery is sent.
 */
class UnresolvableWebhookHost extends UnsafeWebhookUrl {}
