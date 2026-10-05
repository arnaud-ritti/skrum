<?php

use App\Models\User;
use BaconQrCode\Common\ErrorCorrectionLevel;
use BaconQrCode\Encoder\Encoder;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

it('draws the QR code with the highest error correction, so the logo over its middle leaves it readable', function () {
    $user = User::factory()->withTwoFactor()->create();
    $writer = new Writer(new ImageRenderer(
        new RendererStyle(192, 0, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(45, 55, 72))),
        new SvgImageBackEnd,
    ));
    $highCorrection = $writer->writeString($user->twoFactorQrCodeUrl(), Encoder::DEFAULT_BYTE_MODE_ENCODING, ErrorCorrectionLevel::H());

    expect($user->twoFactorQrCodeSvg())->toBe(trim(substr($highCorrection, strpos($highCorrection, "\n") + 1)));
});
