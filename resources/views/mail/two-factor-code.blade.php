@extends('mail.layout')

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('Enter this code to continue.') }} {{ __('It expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) }}</p>
<p class="m-panel m-text" aria-label="{{ implode(' ', str_split($code)) }}" style="margin:16px 0;padding:16px;background-color:{{ $colors['light']['muted'] }};border:1px dashed {{ $colors['light']['input'] }};border-radius:8px;text-align:center;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:32px;line-height:40px;font-weight:bold;letter-spacing:4px;color:{{ $colors['light']['foreground'] }};">{{ $groups[0] }}&nbsp;{{ $groups[1] }}</p>
@if($device !== null)
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Requested from :device.', ['device' => $device]) }}</p>
@endif
@endsection

@section('footer')
<p style="margin:0;">{{ __('Not you? Someone knows your password.') }} <a class="m-muted" href="{{ $passwordUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Change your password') }}</a></p>
@endsection
