{!! __('Sign in to :app', ['app' => $brand->name()]) !!}

{!! __('Use the button below to sign in as') !!} {!! $email !!}. {!! __('The link works once and expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) !!}

{!! __('Button not working? Paste this link into your browser:') !!}
{!! $url !!}

{!! __("Didn't ask for this? Ignore this email — nobody can sign in without the link.") !!}

{!! __('You get this email because you have an account on this instance.') !!}
{!! $brand->name() !!} · {!! $brand->host() !!}
