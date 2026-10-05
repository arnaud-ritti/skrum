import { http } from '@inertiajs/core';
import { createInertiaApp, router } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import BroadcastAuthorizationsController from '@/actions/App/Http/Controllers/BroadcastAuthorizationsController';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import { loadDocumentOnMaintenance } from '@/lib/maintenance-reload';
import { followAccountMotion } from '@/lib/motion';
import {
    followWorkspace,
    onlineWorkspaceId,
} from '@/lib/realtime/workspace-presence';
import { echoConnection } from '@/lib/reverb-config';

const connection = typeof window !== 'undefined' ? echoConnection() : null;

if (connection) {
    configureEcho({
        broadcaster: 'reverb',
        ...connection,
        enabledTransports: ['ws', 'wss'],
        channelAuthorization: {
            customHandler: ({ socketId, channelName }, callback) => {
                http.getClient()
                    .request({
                        method: 'post',
                        url: BroadcastAuthorizationsController.store.url(),
                        data: {
                            socket_id: socketId,
                            channel_name: channelName,
                        },
                        headers: { Accept: 'application/json' },
                    })
                    .then((response) =>
                        callback(null, JSON.parse(response.data)),
                    )
                    .catch((error: Error) => callback(error, null));
            },
        },
    });
}

if (typeof window !== 'undefined') {
    loadDocumentOnMaintenance();
    followAccountMotion();
    router.on('navigate', (event) =>
        followWorkspace(onlineWorkspaceId(event.detail.page.props)),
    );
}

void createInertiaApp({
    title: (title, page) => {
        const appName =
            typeof page.props.name === 'string' ? page.props.name : 'Skrüm';

        return title ? `${title} - ${appName}` : appName;
    },
    layout: () => null,
    strictMode: true,
    withApp(app, { page }) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster
                    containerAriaLabel={page.props.translations?.Notifications}
                />
            </TooltipProvider>
        );
    },
    progress: {
        color: 'var(--primary)',
    },
});

// This will set light / dark mode on load...
initializeTheme();
