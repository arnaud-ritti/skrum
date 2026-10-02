import type { NewApiToken } from '@/types/api-tokens';
import type { Auth } from '@/types/auth';
import type { Brand } from '@/types/brand';
import type { FlashToast } from '@/types/ui';
import type {
    CurrentTeam,
    CurrentWorkspace,
    TeamSummary,
    WorkspaceSummary,
} from '@/types/workspaces';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            brand: Brand;
            adminUrl: string | null;
            auth: Auth;
            sidebarOpen: boolean;
            locale: string;
            locales: string[];
            translations: Record<string, string>;
            workspaces: WorkspaceSummary[];
            currentWorkspace: CurrentWorkspace | null;
            teams: TeamSummary[];
            currentTeam: CurrentTeam | null;
            notifications: { unreadCount: number } | null;
            actionItems: { overdueAssignedCount: number } | null;
            features: { mcp: boolean };
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: FlashToast;
            invitationUrl?: string;
            newToken?: NewApiToken;
        };
    }
}
