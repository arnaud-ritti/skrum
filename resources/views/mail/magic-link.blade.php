@extends('mail.layout')

@section('heading', __('Sign in to :app', ['app' => $brand->name()]))

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{!! str_replace(e($email), '<strong>'.e($email).'</strong>', e(__('Use the button below to sign in as :email.', ['email' => $email]))) !!} {{ __('The link works once and expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) }}</p>
@include('mail.partials.button', ['url' => $url, 'label' => __('Sign in')])
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Button not working? Paste this link into your browser:') }}<br><a class="m-link" href="{{ $url }}" style="font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;color:{{ $colors['light']['skrum-primary-text'] }};text-decoration:underline;">{{ $url }}</a></p>
@include('mail.partials.rule')
<p class="m-muted" style="margin:0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __("Didn't ask for this? Ignore this email — nobody can sign in without the link.") }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You get this email because you have an account on this instance.') }}</p>
@endsection
