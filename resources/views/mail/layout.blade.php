<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $title }}</title>
<style>
@verbatim
@media (max-width: 600px) {
.m-pad { padding-left: 16px !important; padding-right: 16px !important; }
}
@media (prefers-color-scheme: dark) {
@endverbatim
@include('mail.partials.dark', ['prefix' => ''])
}
@include('mail.partials.dark', ['prefix' => '[data-ogsc] '])
@include('mail.partials.dark', ['prefix' => '[data-ogsb] '])
</style>
</head>
<body class="m-bg" style="margin:0;padding:0;background-color:{{ $colors['light']['muted'] }};">
<div style="display:none;max-height:0;overflow:hidden;">{{ $preheader }}</div>
<table role="presentation" class="m-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{ $colors['light']['muted'] }};">
<tr>
<td align="center" class="m-pad" style="padding:32px 24px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr>
<td class="m-card m-pad" style="padding:24px;background-color:{{ $colors['light']['card'] }};border:1px solid {{ $colors['light']['border'] }};border-radius:10px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
@if($brand->logoUrl() !== null)
<img src="{{ $brand->logoUrl() }}" alt="{{ $brand->name() }}" height="28" style="display:block;border:0;height:28px;width:auto;">
@else
<p class="m-text" style="margin:0;font-size:18px;line-height:28px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $brand->name() }}</p>
@endif
<h1 class="m-text" style="margin:24px 0 12px;font-size:20px;line-height:28px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $title }}</h1>
@yield('content')
</td>
</tr>
<tr>
<td align="center" class="m-muted m-pad" style="padding:16px 24px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:{{ $colors['light']['muted-foreground'] }};">
@yield('footer')
<p style="margin:8px 0 0;"><a class="m-muted" href="{{ $brand->instanceUrl() }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ $brand->name() }}</a>@if($brand->poweredBy()) · {{ __('Powered by Skrüm') }}@endif</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
