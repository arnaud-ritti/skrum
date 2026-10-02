@extends('mail.layout')

@section('lead')
<div style="margin:16px 0 0;">
@include('mail.partials.avatar', ['initials' => $inviterInitials, 'presence' => $inviterPresence, 'size' => 44])
</div>
@endsection

@section('heading', __(':inviter invited you to join the :workspace workspace', ['inviter' => $inviterName, 'workspace' => $workspaceName]))

@section('content')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
<tr>
<td class="m-rule" style="padding:12px;border:1px solid {{ $colors['light']['border'] }};border-radius:10px;font-size:14px;line-height:20px;">
<strong class="m-text" style="color:{{ $colors['light']['foreground'] }};">{{ $workspaceName }}</strong>
@if($teamsCount !== null && $membersCount !== null)
<br><span class="m-muted" style="color:{{ $colors['light']['muted-foreground'] }};">{{ trans_choice('{1} :count team|[2,*] :count teams', $teamsCount) }} · {{ trans_choice('{1} :count member|[2,*] :count members', $membersCount) }}</span>
@endif
</td>
</tr>
</table>
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __(':workspace runs its retros, planning poker and icebreakers on :app.', ['workspace' => $workspaceName, 'app' => $brand->name()]) }} {{ $joinSentence }}</p>
@include('mail.partials.button', ['url' => $url, 'label' => __('Accept invitation')])
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __("The invitation is valid for :days days. Don't know :inviter? Just ignore this email.", ['days' => $validDays, 'inviter' => $inviterFirstName]) }}</p>
@endsection
