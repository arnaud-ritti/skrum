@extends('mail.layout')

@section('heading', __('Your verification code'))

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('Enter this code to continue.') }} {{ __('It expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) }}</p>
<p class="m-panel m-text" aria-label="{{ implode(' ', str_split($code)) }}" style="margin:12px 0;padding:16px;background-color:{{ $colors['light']['muted'] }};border:1px dashed {{ $colors['light']['input'] }};border-radius:10px;text-align:center;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:32px;line-height:40px;font-weight:bold;letter-spacing:6px;color:{{ $colors['light']['foreground'] }};">{{ $groups[0] }}&nbsp;{{ $groups[1] }}</p>
<p class="m-muted" style="margin:0;font-size:13px;line-height:20px;text-align:center;color:{{ $colors['light']['muted-foreground'] }};">{{ $device === null ? __('Requested on :time', ['time' => $requestedAt]) : __('Requested from :device · :time', ['device' => $device, 'time' => $requestedAt]) }}</p>
@include('mail.partials.rule')
<p class="m-muted" style="margin:0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Not you? Someone has your password:') }} <a class="m-link" href="{{ $passwordUrl }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ __('change it now') }}</a>. {{ __("They can't sign in without this code.") }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You get this email because you have an account on this instance.') }}</p>
@endsection
