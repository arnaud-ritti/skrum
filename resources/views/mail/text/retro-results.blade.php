{!! $heading !!}

{!! $lead !!}

@foreach($stats as $stat)
{!! $stat['label'] !!}: {!! $stat['value'] !!}
@endforeach
@if($actions !== [])

{!! __('Action items') !!}
@foreach($actions as $action)
- {!! $action['content'] !!} ({!! $action['meta'] !!})
@endforeach
@if($moreActions !== null)
{!! $moreActions !!}
@endif
@endif
@if($roti !== null)

{!! $roti['label'] !!}
@foreach($roti['rows'] as $row)
{!! $row['score'] !!}: {!! $row['count'] !!}
@endforeach
@endif
@if($participantsLine !== null)

{!! $participantsLine !!}
@endif
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
@if($healthLine !== null)

{!! $healthLine !!}
@endif

{!! __('Open the full summary') !!}: {!! $url !!}

{!! __('You get this summary because you took part in this retro or belong to its team.') !!}
{!! __('Manage notifications') !!}: {!! $settingsUrl !!}
@if($unsubscribeUrl !== null)
{!! __('Unsubscribe from recaps') !!}: {!! $unsubscribeUrl !!}
@endif
{!! $brand->name() !!} · {!! $brand->host() !!}
