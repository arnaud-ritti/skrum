@extends('mail.layout')

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('Use the button to sign in as') }} <strong>{{ $email }}</strong>. {{ __('The link works once and expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) }}</p>
@include('mail.partials.button', ['url' => $url, 'label' => __('Sign in')])
<p class="m-muted" style="margin:12px 0 4px;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Or paste this link in your browser:') }}</p>
<p class="m-panel m-text" style="margin:0;padding:8px;background-color:{{ $colors['light']['muted'] }};border:1px dashed {{ $colors['light']['input'] }};border-radius:8px;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:20px;word-break:break-all;color:{{ $colors['light']['foreground'] }};">{{ $url }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You did not ask for this? Ignore this e-mail: nobody can sign in without the link.') }}</p>
@endsection
