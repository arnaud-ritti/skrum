<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
<tr>
<td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ $url }}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="18%" strokecolor="{{ $colors['light']['primary'] }}" fillcolor="{{ $colors['light']['primary'] }}">
<w:anchorlock/>
<center style="color:{{ $colors['light']['primary-foreground'] }};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">{{ $label }}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a class="m-button" href="{{ $url }}" style="display:inline-block;padding:12px 24px;background-color:{{ $colors['light']['primary'] }};border:1px solid {{ $colors['light']['primary'] }};border-radius:8px;color:{{ $colors['light']['primary-foreground'] }};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">{{ $label }}</a>
<!--<![endif]-->
</td>
</tr>
</table>
