<?php

namespace App\Mail;

use App\Support\Mail\MailBrand;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Support\Str;

class WorkspaceInvitationMail extends BrandedMail
{
    public function __construct(
        public string $workspaceName,
        public string $inviterName,
        public string $url,
        public string $inviterInitials,
        public int $inviterPresence,
        public ?int $teamsCount,
        public ?int $membersCount,
        public bool $canUseSso,
        public bool $canRegister,
        public int $validDays,
        public ?string $teamName = null,
        public ?string $teamInitial = null,
        public ?string $teamColor = null,
        public ?int $teamMembersCount = null,
        public ?string $inviterMessage = null,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.workspace-invitation',
            text: 'mail.text.workspace-invitation',
            with: [
                ...$this->brandData(),
                'title' => $this->subject,
                'preheader' => __(':workspace runs its retros, planning poker and icebreakers on :app.', [
                    'workspace' => $this->teamName ?? $this->workspaceName,
                    'app' => resolve(MailBrand::class)->name(),
                ]),
                'inviterFirstName' => Str::before($this->inviterName, ' '),
                'joinSentence' => $this->joinSentence(),
            ],
        );
    }

    private function joinSentence(): string
    {
        if ($this->canUseSso && $this->canRegister) {
            return __('Join with your company SSO or create an account in a minute.');
        }

        if ($this->canUseSso) {
            return __('Join with your company SSO.');
        }

        return __('Create an account in a minute.');
    }
}
