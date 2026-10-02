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
@php($logo = $brand->logo())
<body class="m-bg" style="margin:0;padding:0;background-color:{{ $colors['light']['muted'] }};">
<div style="display:none;max-height:0;overflow:hidden;">{{ $preheader }}</div>
<table role="presentation" class="m-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{ $colors['light']['muted'] }};">
<tr>
<td align="center" class="m-pad" style="padding:32px 24px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr>
<td class="m-card m-pad" style="padding:20px 24px 24px;background-color:{{ $colors['light']['card'] }};border:1px solid {{ $colors['light']['border'] }};border-radius:10px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
@if($logo !== null)
<img class="m-logo-light" src="{{ $logo['light'] }}" alt="{{ $brand->name() }}" width="{{ $logo['width'] }}" height="{{ $logo['height'] }}" style="display:block;border:0;width:{{ $logo['width'] }}px;height:{{ $logo['height'] }}px;">
@if($logo['dark'] !== $logo['light'])
<!--[if !mso]><!-->
<div class="m-logo-dark" style="display:none;max-height:0;overflow:hidden;mso-hide:all;"><img src="{{ $logo['dark'] }}" alt="{{ $brand->name() }}" width="{{ $logo['darkWidth'] }}" height="{{ $logo['height'] }}" style="display:block;border:0;width:{{ $logo['darkWidth'] }}px;height:{{ $logo['height'] }}px;"></div>
<!--<![endif]-->
@endif
@else
<p class="m-text" style="margin:0;font-size:16px;line-height:28px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $brand->name() }}</p>
@endif
@yield('lead')
<h1 class="m-text" style="margin:16px 0 12px;font-size:20px;line-height:28px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">@yield('heading')</h1>
@yield('content')
</td>
</tr>
<tr>
<td align="center" class="m-muted m-pad" style="padding:16px 24px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:{{ $colors['light']['muted-foreground'] }};">
@yield('footer')
<p style="margin:4px 0 0;">{{ $brand->name() }} · {{ $brand->host() }}</p>
@if($brand->poweredBy())
<p style="margin:4px 0 0;">{{ __('Powered by Skrüm') }}</p>
@endif
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
