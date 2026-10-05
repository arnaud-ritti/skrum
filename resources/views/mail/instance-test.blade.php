@extends('mail.layout')

@section('heading', $title)

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('The mail settings of :name deliver.', ['name' => $instanceName]) }} {{ __('Nothing else to do: you can delete this email.') }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You get this email because an admin of this instance sent a test email to this address.') }}</p>
@endsection
