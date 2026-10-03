import { http } from '@inertiajs/core';
import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import BroadcastAuthorizationsController from '@/actions/App/Http/Controllers/BroadcastAuthorizationsController';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import { loadDocumentOnMaintenance } from '@/lib/maintenance-reload';
import { followAccountMotion } from '@/lib/motion';
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
}

void createInertiaApp({
    title: (title, page) => {
        const appName =
            typeof page.props.name === 'string' ? page.props.name : 'Skrum';

        return title ? `${title} - ${appName}` : appName;
    },
    layout: () => null,
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {app}
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        color: 'var(--primary)',
    },
});

// This will set light / dark mode on load...
initializeTheme();
