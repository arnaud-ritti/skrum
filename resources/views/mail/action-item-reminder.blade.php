@extends('mail.layout')

@section('content')
@foreach([[__('Overdue'), $overdue, true], [__('Due soon'), $dueSoon, false]] as [$heading, $items, $late])
@if($items !== [])
<p class="m-text" style="margin:16px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $heading }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
@foreach($items as $item)
<tr>
<td class="m-rule" style="padding:8px 0;border-top:1px solid {{ $colors['light']['border'] }};font-size:15px;line-height:24px;">
<a class="m-link" href="{{ $item['url'] }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ $item['content'] }}</a><br>
<span class="m-muted" style="font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $item['team'] }} · {{ $item['source'] }} · </span><span class="{{ $late ? 'm-danger' : 'm-muted' }}" style="font-size:13px;line-height:20px;color:{{ $late ? $colors['light']['skrum-destructive-text'] : $colors['light']['muted-foreground'] }};">{{ $item['due'] }}</span>
</td>
</tr>
@endforeach
</table>
@endif
@endforeach
@if($hidden > 0)
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('And :count more.', ['count' => $hidden]) }}</p>
@endif
@if($listUrl !== null)
@include('mail.partials.button', ['url' => $listUrl, 'label' => __('View my open action items')])
@endif
@endsection

@section('footer')
<p style="margin:0;">{{ __('You can turn off these reminders in your notification settings.') }}</p>
<p style="margin:8px 0 0;"><a class="m-muted" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Notification settings') }}</a> · <a class="m-muted" href="{{ $unsubscribeUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Unsubscribe from reminders') }}</a></p>
@endsection
