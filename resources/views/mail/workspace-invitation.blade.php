@extends('mail.layout')

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __(':inviter invited you to join the :workspace workspace.', ['inviter' => $inviterName, 'workspace' => $workspaceName]) }}</p>
@include('mail.partials.button', ['url' => $url, 'label' => __('Accept invitation')])
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('This invitation expires on :date.', ['date' => $expiresAt->isoFormat('LL')]) }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You do not know :inviter? Ignore this e-mail.', ['inviter' => $inviterName]) }}</p>
@endsection
