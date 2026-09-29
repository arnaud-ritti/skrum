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

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

configureEcho({
    broadcaster: 'reverb',
    channelAuthorization: {
        customHandler: ({ socketId, channelName }, callback) => {
            http.getClient()
                .request({
                    method: 'post',
                    url: BroadcastAuthorizationsController.store.url(),
                    data: { socket_id: socketId, channel_name: channelName },
                    headers: { Accept: 'application/json' },
                })
                .then((response) => callback(null, JSON.parse(response.data)))
                .catch((error: Error) => callback(error, null));
        },
    },
});

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name === 'retros/join':
                return AuthLayout;
            case name === 'retros/show':
                return null;
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
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
