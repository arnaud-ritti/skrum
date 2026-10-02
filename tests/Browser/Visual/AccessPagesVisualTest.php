<?php

it('renders the access pages without overflow', function (string $name, string $path, string $marker) {
    config([
        'app.name' => 'Skrum',
        'oidc.connections.generic.base_url' => 'https://sso.example.com',
        'oidc.connections.generic.client_id' => 'visual-test',
        'oidc.connections.generic.client_secret' => 'visual-test',
        'oidc.connections.generic.label' => 'SSO (OIDC)',
        'services.google.client_id' => 'visual-test',
        'services.google.client_secret' => 'visual-test',
        'services.github.client_id' => 'visual-test',
        'services.github.client_secret' => 'visual-test',
    ]);

    $this->captureVisuals(
        $name,
        $path,
        fn (string $path, array $options) => visit($path, $options)->assertPresent($marker),
    );
})->with([
    'login' => ['access-login-page', '/login', '[data-slot="login-form"] [data-slot="sso-buttons"]'],
    'register' => ['access-register-page', '/register', '[data-slot="register-form"] [data-slot="sso-buttons"]'],
]);
