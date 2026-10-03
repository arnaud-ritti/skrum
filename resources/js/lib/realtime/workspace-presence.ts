import { echo, echoIsConfigured } from '@laravel/echo-react';

type OnlineMember = { id: string };

type PresenceProps = {
    auth?: { user?: { id: string } | null };
    currentWorkspace?: { id: string } | null;
};

/**
 * Who has a signed-in page of the current workspace open. One channel per
 * workspace, joined once for the whole application (not per page), so that
 * moving between pages never shows anyone leaving.
 */
let followedWorkspaceId: string | null = null;
let onlineUserIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function channelName(workspaceId: string): string {
    return `workspace-online.${workspaceId}`;
}

function publish(next: ReadonlySet<string>): void {
    onlineUserIds = next;
    listeners.forEach((listener) => listener());
}

export function onlineWorkspaceId(props: PresenceProps): string | null {
    if (!props.auth?.user) {
        return null;
    }

    return props.currentWorkspace?.id ?? null;
}

export function followWorkspace(workspaceId: string | null): void {
    if (workspaceId === followedWorkspaceId) {
        return;
    }

    if (followedWorkspaceId !== null && echoIsConfigured()) {
        echo().leave(channelName(followedWorkspaceId));
    }

    followedWorkspaceId = workspaceId;
    publish(new Set());

    if (workspaceId === null || !echoIsConfigured()) {
        return;
    }

    echo<'reverb'>()
        .join(channelName(workspaceId))
        .here((members: OnlineMember[]) =>
            publish(new Set(members.map((member) => member.id))),
        )
        .joining((member: OnlineMember) =>
            publish(new Set([...onlineUserIds, member.id])),
        )
        .leaving((member: OnlineMember) =>
            publish(
                new Set([...onlineUserIds].filter((id) => id !== member.id)),
            ),
        );
}

export function subscribeOnline(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
}

export function onlineSnapshot(): ReadonlySet<string> {
    return onlineUserIds;
}
