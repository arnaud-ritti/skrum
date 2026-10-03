{!! $title !!}

{!! $summary !!}
@if($changedLabels !== [])

{!! __('Fields changed') !!}
@foreach($changedLabels as $label)
- {!! $label !!}
@endforeach
@endif
@if($clearedLabels !== [])

{!! __('Fields back to the environment value') !!}
@foreach($clearedLabels as $label)
- {!! $label !!}
@endforeach
@endif

{!! $warning !!}

{!! __('Open the section') !!}: {!! $sectionUrl !!}

{!! __('You get this email because you are an admin of this instance.') !!}
{!! $brand->name() !!} · {!! $brand->host() !!}
