{!! $prefix !!}.m-bg { background-color: {{ $colors['dark']['muted'] }} !important; }
{!! $prefix !!}.m-card { background-color: {{ $colors['dark']['card'] }} !important; border-color: {{ $colors['dark']['border'] }} !important; }
{!! $prefix !!}.m-panel { background-color: {{ $colors['dark']['muted'] }} !important; border-color: {{ $colors['dark']['input'] }} !important; }
{!! $prefix !!}.m-soft { background-color: {{ $colors['dark']['muted'] }} !important; }
{!! $prefix !!}.m-rule { border-color: {{ $colors['dark']['border'] }} !important; }
{!! $prefix !!}.m-line { background-color: {{ $colors['dark']['border'] }} !important; }
{!! $prefix !!}.m-box { border-color: {{ $colors['dark']['input'] }} !important; }
{!! $prefix !!}.m-text { color: {{ $colors['dark']['foreground'] }} !important; }
{!! $prefix !!}.m-muted { color: {{ $colors['dark']['muted-foreground'] }} !important; }
{!! $prefix !!}.m-link { color: {{ $colors['dark']['skrum-primary-text'] }} !important; }
{!! $prefix !!}.m-danger { color: {{ $colors['dark']['skrum-destructive-text'] }} !important; }
{!! $prefix !!}.m-button { background-color: {{ $colors['dark']['primary'] }} !important; border-color: {{ $colors['dark']['primary'] }} !important; color: {{ $colors['dark']['primary-foreground'] }} !important; }
{!! $prefix !!}.m-logo-light { display: none !important; }
{!! $prefix !!}.m-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
@foreach(range(1, 12) as $presence)
{!! $prefix !!}.m-p{{ $presence }} { background-color: {{ $colors['dark']["skrum-presence-{$presence}"] }} !important; color: {{ $colors['dark']["skrum-presence-{$presence}-foreground"] }} !important; }
@endforeach
@foreach(range(1, 5) as $score)
{!! $prefix !!}.m-r{{ $score }} { background-color: {{ $colors['dark']["skrum-roti-{$score}"] }} !important; color: {{ $colors['dark']['skrum-roti-foreground'] }} !important; }
@endforeach
