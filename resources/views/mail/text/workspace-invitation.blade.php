{!! __(':inviter invited you to join the :workspace workspace.', ['inviter' => $inviterName, 'workspace' => $workspaceName]) !!}

{!! __('Accept invitation') !!}: {!! $url !!}

{!! __('This invitation expires on :date.', ['date' => $expiresAt->isoFormat('LL')]) !!}
