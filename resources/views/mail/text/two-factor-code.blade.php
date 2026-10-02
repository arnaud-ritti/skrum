{!! __('Your verification code') !!}

{!! __('Enter this code to continue.') !!} {!! __('It expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) !!}

{!! $groups[0] !!} {!! $groups[1] !!}

{!! $device === null ? __('Requested on :time', ['time' => $requestedAt]) : __('Requested from :device · :time', ['device' => $device, 'time' => $requestedAt]) !!}

{!! __('Not you? Someone has your password:') !!} {!! __('change it now') !!}: {!! $passwordUrl !!}
{!! __("They can't sign in without this code.") !!}

{!! __('You get this email because you have an account on this instance.') !!}
{!! $brand->name() !!} · {!! $brand->host() !!}
