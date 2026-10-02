@foreach($facts as $fact)
{!! $fact !!}
@endforeach
@if($summary !== [])

{!! __('Summary') !!}
@foreach($summary as $paragraph)
{!! $paragraph !!}
@endforeach
@endif
@foreach($sections as $section)

{!! $section['heading'] !!}
@foreach($section['lines'] as $line)
- {!! $line !!}
@endforeach
@if($section['more'] !== null)
{!! $section['more'] !!}
@endif
@endforeach

{!! __('View the results') !!}: {!! $url !!}
{!! __('Notification settings') !!}: {!! $settingsUrl !!}
@if($unsubscribeUrl !== null)
{!! __('Unsubscribe from recaps') !!}: {!! $unsubscribeUrl !!}
@endif
