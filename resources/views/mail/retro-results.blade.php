@extends('mail.layout')

@section('content')
@foreach($facts as $fact)
<p class="m-text" style="margin:0 0 4px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $fact }}</p>
@endforeach
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
@include('mail.partials.button', ['url' => $url, 'label' => __('View the results')])
@endsection

@section('footer')
<p style="margin:0;">{{ __('You receive this e-mail because you took part in this retrospective or belong to its team.') }}</p>
<p style="margin:8px 0 0;"><a class="m-muted" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Notification settings') }}</a>@if($unsubscribeUrl !== null) · <a class="m-muted" href="{{ $unsubscribeUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Unsubscribe from recaps') }}</a>@endif</p>
@endsection
