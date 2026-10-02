@foreach([[__('Overdue'), $overdue], [__('Due soon'), $dueSoon]] as [$heading, $items])
@if($items !== [])
{!! $heading !!}
@foreach($items as $item)
- {!! $item['content'] !!} ({!! $item['team'] !!} · {!! $item['source'] !!} · {!! $item['due'] !!})
  {!! $item['url'] !!}
@endforeach

@endif
@endforeach
@if($hidden > 0)
{!! __('And :count more.', ['count' => $hidden]) !!}

@endif
{!! __('Notification settings') !!}: {!! $settingsUrl !!}
{!! __('Unsubscribe from reminders') !!}: {!! $unsubscribeUrl !!}
