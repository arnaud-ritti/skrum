@extends('mail.layout')

@section('heading', $heading)

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $lead }}</p>
<table role="presentation" class="m-soft" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{ $colors['light']['muted'] }};border-radius:10px;">
<tr>
@foreach($stats as $stat)
@include('mail.partials.stat', ['value' => $stat['value'], 'label' => $stat['label'], 'width' => intdiv(100, count($stats))])
@endforeach
</tr>
</table>
@if($actions !== [])
<p class="m-muted" style="margin:16px 0 4px;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Action items') }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;line-height:20px;">
@foreach($actions as $action)
<tr>
<td width="32" valign="top" style="width:32px;padding:8px 0;">
@if($action['initials'] !== null && $action['presence'] !== null)
@include('mail.partials.avatar', ['initials' => $action['initials'], 'presence' => $action['presence'], 'size' => 24])
@else
<span class="m-box" style="display:block;width:21px;height:21px;border:1.5px solid {{ $colors['light']['input'] }};border-radius:24px;">&nbsp;</span>
@endif
</td>
<td valign="top" style="padding:8px 8px 8px 0;">
<strong class="m-text" style="color:{{ $colors['light']['foreground'] }};">{{ $action['content'] }}</strong><br>
<span class="m-muted" style="color:{{ $colors['light']['muted-foreground'] }};">{{ $action['meta'] }}</span>
</td>
</tr>
@endforeach
</table>
@if($moreActions !== null)
<p class="m-muted" style="margin:4px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $moreActions }}</p>
@endif
@endif
@if($roti !== null)
<p class="m-muted" style="margin:16px 0 4px;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:{{ $colors['light']['muted-foreground'] }};">{{ $roti['label'] }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:13px;line-height:20px;">
@foreach($roti['rows'] as $row)
<tr>
<td width="24" style="width:24px;padding:2px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="m-r{{ $row['score'] }}" align="center" width="24" height="24" style="width:24px;height:24px;border-radius:24px;background-color:{{ $colors['light']["skrum-roti-{$row['score']}"] }};color:{{ $colors['light']['skrum-roti-foreground'] }};font-size:12px;line-height:24px;font-weight:bold;text-align:center;">{{ $row['score'] }}</td></tr></table>
</td>
<td style="padding:2px 8px;">
<table role="presentation" class="m-soft" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{ $colors['light']['muted'] }};border-radius:10px;">
<tr>
<td style="padding:0;font-size:0;line-height:0;">
@if($row['width'] > 0)
<table role="presentation" width="{{ $row['width'] }}%" cellpadding="0" cellspacing="0" border="0" style="width:{{ $row['width'] }}%;"><tr><td class="m-r{{ $row['score'] }}" height="10" style="height:10px;border-radius:10px;background-color:{{ $colors['light']["skrum-roti-{$row['score']}"] }};font-size:0;line-height:0;">&nbsp;</td></tr></table>
@else
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td height="10" style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
@endif
</td>
</tr>
</table>
</td>
<td class="m-text" width="24" align="right" style="width:24px;padding:2px 0;text-align:right;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $row['count'] }}</td>
</tr>
@endforeach
</table>
@endif
@if($participantsLine !== null)
<p class="m-muted" style="margin:16px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $participantsLine }}</p>
@endif
@if($summary !== [])
<p class="m-text" style="margin:16px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ __('Summary') }}</p>
@foreach($summary as $paragraph)
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $paragraph }}</p>
@endforeach
@endif
@foreach($sections as $section)
<p class="m-text" style="margin:16px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $section['heading'] }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
@foreach($section['lines'] as $line)
<tr>
<td class="m-text m-rule" style="padding:8px 0;border-top:1px solid {{ $colors['light']['border'] }};font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $line }}</td>
</tr>
@endforeach
</table>
@if($section['more'] !== null)
<p class="m-muted" style="margin:8px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $section['more'] }}</p>
@endif
@endforeach
@if($healthLine !== null)
<p class="m-muted" style="margin:16px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $healthLine }}</p>
@endif
@include('mail.partials.button', ['url' => $url, 'label' => __('Open the full summary')])
@endsection

@section('footer')
<p style="margin:0;">{{ __('You get this summary because you took part in this retro or belong to its team.') }}</p>
<p style="margin:4px 0 0;"><a class="m-link" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ __('Manage notifications') }}</a>@if($unsubscribeUrl !== null) · <a class="m-link" href="{{ $unsubscribeUrl }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ __('Unsubscribe from recaps') }}</a>@endif</p>
@endsection
