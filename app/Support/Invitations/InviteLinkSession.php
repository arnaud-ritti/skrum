<?php

namespace App\Support\Invitations;

/**
 * The session key that remembers the team invite link a visitor opened, so
 * that registration and single sign-on know the link the visitor came by.
 */
class InviteLinkSession
{
    public const string Key = 'invite_link_token';
}
