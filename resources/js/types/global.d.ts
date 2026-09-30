import type { Auth } from '@/types/auth';
import type { FlashToast } from '@/types/ui';
import type { CurrentWorkspace, WorkspaceSummary } from '@/types/workspaces';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            locale: string;
            locales: string[];
            translations: Record<string, string>;
            workspaces: WorkspaceSummary[];
            currentWorkspace: CurrentWorkspace | null;
            notifications: { unreadCount: number } | null;
            actionItems: { overdueAssignedCount: number } | null;
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: FlashToast;
            invitationUrl?: string;
        };
    }
}
