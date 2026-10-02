@extends('mail.layout')

@section('heading', $title)

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('Agreed by your team in retro. Mark them done, change the due date, or hand them over.') }}</p>
@foreach([[__('Overdue'), $overdue, true], [__('Due soon'), $dueSoon, false]] as [$label, $items, $late])
@if($items !== [])
@if($overdue !== [] && $dueSoon !== [])
<p class="m-muted" style="margin:16px 0 4px;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:{{ $colors['light']['muted-foreground'] }};">{{ $label }}</p>
@endif
<table role="presentation" class="m-rule" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid {{ $colors['light']['border'] }};border-radius:10px;border-collapse:separate;font-size:14px;line-height:20px;">
@foreach($items as $item)
<tr>
<td class="m-rule" width="28" valign="top" style="width:28px;padding:12px 0 12px 12px;{{ $loop->last ? '' : "border-bottom:1px solid {$colors['light']['border']};" }}"><span class="m-box" style="display:block;width:13px;height:13px;margin-top:2px;border:1.5px solid {{ $colors['light']['input'] }};border-radius:4px;">&nbsp;</span></td>
<td class="m-rule" valign="top" style="padding:12px;{{ $loop->last ? '' : "border-bottom:1px solid {$colors['light']['border']};" }}">
<a class="m-text" href="{{ $item['url'] }}" style="font-weight:bold;text-decoration:none;color:{{ $colors['light']['foreground'] }};">{{ $item['content'] }}</a><br>
@if($late && $item['daysLate'] > 0)
<span class="m-danger" style="font-size:13px;font-weight:bold;color:{{ $colors['light']['skrum-destructive-text'] }};">{{ __(':team · due :date · :late', ['team' => $item['team'], 'date' => $item['due'], 'late' => trans_choice('{1} :count day late|[2,*] :count days late', $item['daysLate'])]) }}</span>
@else
<span class="m-muted" style="font-size:13px;color:{{ $colors['light']['muted-foreground'] }};">{{ __(':team · due :date', ['team' => $item['team'], 'date' => $item['due']]) }}</span>
@endif
</td>
@if($item['ticket'] !== null)
<td class="m-muted m-rule" align="right" valign="top" style="padding:12px 12px 12px 0;{{ $loop->last ? '' : "border-bottom:1px solid {$colors['light']['border']};" }}font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:12px;white-space:nowrap;text-align:right;color:{{ $colors['light']['muted-foreground'] }};">{{ $item['ticket'] }}</td>
@else
<td class="m-rule" style="padding:0;{{ $loop->last ? '' : "border-bottom:1px solid {$colors['light']['border']};" }}font-size:0;line-height:0;">&nbsp;</td>
@endif
</tr>
@endforeach
</table>
@endif
@endforeach
@if($hidden > 0)
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('And :count more.', ['count' => $hidden]) }}</p>
@endif
@if($listUrl !== null)
@include('mail.partials.button', ['url' => $listUrl, 'label' => __('Open my action items')])
@endif
@endsection

@section('footer')
<p style="margin:0;">{{ __('You get this reminder because action items are assigned to you.') }}</p>
<p style="margin:4px 0 0;"><a class="m-link" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ __('Manage notifications') }}</a> · <a class="m-link" href="{{ $unsubscribeUrl }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ __('Unsubscribe from reminders') }}</a></p>
@endsection
