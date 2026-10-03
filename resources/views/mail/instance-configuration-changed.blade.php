@extends('mail.layout')

@section('heading', $title)

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $summary }}</p>
@if($changedLabels !== [])
<p class="m-text" style="margin:12px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ __('Fields changed') }}</p>
<ul class="m-text" style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">
@foreach($changedLabels as $label)
<li>{{ $label }}</li>
@endforeach
</ul>
@endif
@if($clearedLabels !== [])
<p class="m-text" style="margin:12px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ __('Fields back to the environment value') }}</p>
<ul class="m-text" style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">
@foreach($clearedLabels as $label)
<li>{{ $label }}</li>
@endforeach
</ul>
@endif
<p class="m-text" style="margin:12px 0;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $warning }}</p>
@include('mail.partials.button', ['url' => $sectionUrl, 'label' => __('Open the section')])
@endsection

@section('footer')
<p style="margin:0;">{{ __('You get this email because you are an admin of this instance.') }}</p>
@endsection
