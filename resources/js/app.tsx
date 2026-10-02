import { http } from '@inertiajs/core';
import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import BroadcastAuthorizationsController from '@/actions/App/Http/Controllers/BroadcastAuthorizationsController';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { usesOwnLayout } from '@/lib/page-layouts';
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

void createInertiaApp({
    title: (title, page) => {
        const appName =
            typeof page.props.name === 'string' ? page.props.name : 'Skrum';

        return title ? `${title} - ${appName}` : appName;
    },
    layout: (name) => {
        if (usesOwnLayout(name)) {
            return null;
        }

        switch (true) {
            case name === 'poker/join':
            case name === 'games/join':
            case name === 'whiteboards/join':
                return AuthLayout;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('invitations/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
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
