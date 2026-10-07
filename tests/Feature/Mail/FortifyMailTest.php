<?php

use App\Mail\EmailVerificationMail;
use App\Mail\PasswordResetMail;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Mail\MailBrand;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;

it('renders authentication emails with the instance brand, action and plain-text fallback', function (string $notificationClass, string $mailClass) {
    resolve(InstanceSettings::class)->setMany(['display_name' => 'Team Atlas', 'brand_color' => '#2b63b0']);
    $user = User::factory()->unverified()->create(['locale' => 'fr']);
    $notification = $notificationClass === VerifyEmail::class ? new VerifyEmail : new ResetPassword('reset-token');
    $mail = $notification->toMail($user);

    expect($mail)->toBeInstanceOf($mailClass);
    expect($mail->hasTo($user->email))->toBeTrue();
    expect($mail->locale)->toBe('fr');
    $html = $mail->render();
    expect($html)->toContain('Team Atlas')->toContain('<html lang="fr"')
        ->toContain(resolve(MailBrand::class)->colors()['light']['primary'])
        ->toContain('class="m-card m-pad"')->not->toContain('Regards,');
    $mail->assertSeeInText('Team Atlas');
    $mail->assertSeeInText($mail->url);
})->with([
    'verification' => [VerifyEmail::class, EmailVerificationMail::class],
    'password reset' => [ResetPassword::class, PasswordResetMail::class],
]);

it('delivers the branded verification email with the original valid signed URL', function () {
    config(['mail.default' => 'array']);
    Event::fake([MessageSent::class]);
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)->post(route('verification.send'))->assertRedirect();

    Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($user): bool {
        $url = $event->data['url'];

        return $event->message->getTo()[0]->getAddress() === $user->email
            && str_contains($event->message->getHtmlBody(), 'class="m-card m-pad"')
            && URL::hasValidSignature(Request::create($url))
            && str_contains($url, '/email/verify/'.$user->id.'/'.sha1($user->email));
    });
});

it('delivers the branded reset email with the reset token and account email', function () {
    config(['mail.default' => 'array']);
    Event::fake([MessageSent::class]);
    $user = User::factory()->create();

    $user->notify(new ResetPassword('reset-token'));

    Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($user): bool {
        $url = $event->data['url'];
        parse_str(parse_url($url, PHP_URL_QUERY), $query);

        return $event->message->getTo()[0]->getAddress() === $user->email
            && str_contains($event->message->getHtmlBody(), 'class="m-card m-pad"')
            && str_contains($url, '/reset-password/reset-token') && $query['email'] === $user->email;
    });
});
