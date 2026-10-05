{!! __('Your verification code') !!}

{!! __('Enter this code to continue.') !!} {!! __('It expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) !!}

{!! $groups[0] !!} {!! $groups[1] !!}

{!! $device === null ? __('Requested on :time', ['time' => $requestedAt]) : __('Requested from :device · :time', ['device' => $device, 'time' => $requestedAt]) !!}

@if($confirmsAnAction)
{!! __('Not you? Someone is signed in to your account:') !!} {!! __('sign out the other sessions') !!}: {!! $passwordUrl !!}
{!! __("They can't confirm the action without this code.") !!}
@else
{!! __('Not you? Someone has your password:') !!} {!! __('change it now') !!}: {!! $passwordUrl !!}
{!! __("They can't sign in without this code.") !!}
@endif

{!! __('You get this email because you have an account on this instance.') !!}
{!! $brand->name() !!} · {!! $brand->host() !!}
