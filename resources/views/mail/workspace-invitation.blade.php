@extends('mail.layout')

@section('lead')
<div style="margin:16px 0 0;">
@include('mail.partials.avatar', ['initials' => $inviterInitials, 'presence' => $inviterPresence, 'size' => 44])
</div>
@endsection

@section('heading', $teamName === null
    ? __(':inviter invited you to join the :workspace workspace', ['inviter' => $inviterName, 'workspace' => $workspaceName])
    : __(':inviter invited you to join the :team team in the :workspace workspace', ['inviter' => $inviterName, 'team' => $teamName, 'workspace' => $workspaceName]))

@section('content')
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
<tr>
@if($teamName !== null)
<td class="m-rule" style="padding:12px;border:1px solid {{ $colors['light']['border'] }};border-radius:10px;font-size:14px;line-height:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="m-c-{{ $teamColor }}" align="center" valign="middle" width="36" height="36" style="width:36px;height:36px;border-radius:8px;background-color:{{ $colors['light']["skrum-col-{$teamColor}"] }};border:1px solid {{ $colors['light']["skrum-col-{$teamColor}-border"] }};color:{{ $colors['light']["skrum-col-{$teamColor}-text"] }};font-size:14px;line-height:36px;font-weight:bold;text-align:center;">{{ $teamInitial }}</td>
<td style="padding:0 0 0 12px;font-size:14px;line-height:20px;">
<strong class="m-text" style="color:{{ $colors['light']['foreground'] }};">{{ $teamName }}</strong>
<br><span class="m-muted" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __(':workspace workspace', ['workspace' => $workspaceName]) }} · {{ trans_choice('{1} :count member|[2,*] :count members', $teamMembersCount ?? 0) }}</span>
</td>
</tr>
</table>
</td>
@else
<td class="m-rule" style="padding:12px;border:1px solid {{ $colors['light']['border'] }};border-radius:10px;font-size:14px;line-height:20px;">
<strong class="m-text" style="color:{{ $colors['light']['foreground'] }};">{{ $workspaceName }}</strong>
@if($teamsCount !== null && $membersCount !== null)
<br><span class="m-muted" style="color:{{ $colors['light']['muted-foreground'] }};">{{ trans_choice('{1} :count team|[2,*] :count teams', $teamsCount) }} · {{ trans_choice('{1} :count member|[2,*] :count members', $membersCount) }}</span>
@endif
</td>
@endif
</tr>
</table>
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __(':workspace runs its retros, planning poker and icebreakers on :app.', ['workspace' => $teamName ?? $workspaceName, 'app' => $brand->name()]) }} {{ $joinSentence }}</p>
@if($inviterMessage !== null)
<p class="m-soft m-text" style="margin:0 0 12px;padding:8px 12px;border-radius:6px;background-color:{{ $colors['light']['muted'] }};font-size:14px;line-height:22px;font-style:italic;white-space:pre-line;color:{{ $colors['light']['foreground'] }};">{{ __('“:message”', ['message' => $inviterMessage]) }}</p>
@endif
@include('mail.partials.button', ['url' => $url, 'label' => __('Accept invitation')])
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __("The invitation is valid for :days days. Don't know :inviter? Just ignore this email.", ['days' => $validDays, 'inviter' => $inviterFirstName]) }}</p>
@endsection
