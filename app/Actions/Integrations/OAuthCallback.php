<?php

namespace App\Actions\Integrations;

/**
 * What a provider's redirect brought back: the code, the PKCE verifier
 * issued with the state, and GitHub's installation id.
 */
class OAuthCallback
{
    public function __construct(
        public string $code,
        public ?string $codeVerifier = null,
        public ?string $installationId = null,
    ) {}
}
