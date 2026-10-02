<?php

namespace App\Mail;

use Carbon\CarbonInterface;
use Illuminate\Mail\Mailables\Content;

class WorkspaceInvitationMail extends BrandedMail
{
    public function __construct(
        public string $workspaceName,
        public string $inviterName,
        public string $url,
        public CarbonInterface $expiresAt,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.workspace-invitation',
            text: 'mail.text.workspace-invitation',
            with: [
                ...$this->brandData(),
                'title' => $this->subject,
                'preheader' => __(':inviter invited you to join the :workspace workspace.', [
                    'inviter' => $this->inviterName,
                    'workspace' => $this->workspaceName,
                ]),
            ],
        );
    }
}
