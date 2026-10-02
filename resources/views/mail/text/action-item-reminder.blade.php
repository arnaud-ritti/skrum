{!! $title !!}

{!! __('Agreed by your team in retro. Mark them done, change the due date, or hand them over.') !!}

@foreach([[__('Overdue'), $overdue, true], [__('Due soon'), $dueSoon, false]] as [$label, $items, $late])
@if($items !== [])
@if($overdue !== [] && $dueSoon !== [])
{!! $label !!}
@endif
@foreach($items as $item)
@if($late && $item['daysLate'] > 0)
- {!! $item['content'] !!} ({!! __(':team · due :date · :late', ['team' => $item['team'], 'date' => $item['due'], 'late' => trans_choice('{1} :count day late|[2,*] :count days late', $item['daysLate'])]) !!}){!! $item['ticket'] === null ? '' : " {$item['ticket']}" !!}
@else
- {!! $item['content'] !!} ({!! __(':team · due :date', ['team' => $item['team'], 'date' => $item['due']]) !!}){!! $item['ticket'] === null ? '' : " {$item['ticket']}" !!}
@endif
  {!! $item['url'] !!}
@endforeach

@endif
@endforeach
@if($hidden > 0)
{!! __('And :count more.', ['count' => $hidden]) !!}

@endif
@if($listUrl !== null)
{!! __('Open my action items') !!}: {!! $listUrl !!}

@endif
{!! __('You get this reminder because action items are assigned to you.') !!}
{!! __('Manage notifications') !!}: {!! $settingsUrl !!}
{!! __('Unsubscribe from reminders') !!}: {!! $unsubscribeUrl !!}
{!! $brand->name() !!} · {!! $brand->host() !!}
