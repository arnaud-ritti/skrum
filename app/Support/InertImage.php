<?php

namespace App\Support;

class InertImage
{
    /**
     * Opened on its own, an SVG served with this policy runs no script, loads nothing, submits no form and is sandboxed.
     */
    public const string ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; sandbox";
}
