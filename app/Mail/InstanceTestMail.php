<?php

namespace App\Mail;

use App\Support\Mail\MailBrand;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Not queued on purpose: the admin reads the result of the test as soon as the request ends. */
class InstanceTestMail extends Mailable
{
    public function __construct(public string $instanceName) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine());
    }

    public function content(): Content
    {
        $brand = resolve(MailBrand::class);

        return new Content(
            view: 'mail.instance-test',
            text: 'mail.text.instance-test',
            with: [
                'brand' => $brand,
                'colors' => $brand->colors(),
                'title' => $this->subjectLine(),
                'preheader' => __('The mail settings of :name deliver.', ['name' => $this->instanceName]),
            ],
        );
    }

    private function subjectLine(): string
    {
        return __('Test email from :name', ['name' => $this->instanceName]);
    }
}
