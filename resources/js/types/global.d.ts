import type { NewApiToken } from '@/types/api-tokens';
import type { Auth } from '@/types/auth';
import type { Brand } from '@/types/brand';
import type { FlashToast } from '@/types/ui';
import type {
    CurrentTeam,
    CurrentWorkspace,
    SwitcherWorkspace,
    TeamSummary,
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
            /** Sent to instance admins only, while required single sign-on has no provider. */
            signInAlert: 'sso_required_ignored' | null;
            /** True for instance admins while only single sign-on signs in. */
            ssoInForce: boolean;
            auth: Auth;
            sidebarOpen: boolean;
            locale: string;
            locales: string[];
            translations: Record<string, string>;
            workspaces: SwitcherWorkspace[];
            currentWorkspace: CurrentWorkspace | null;
            teams: TeamSummary[];
            currentTeam: CurrentTeam | null;
            notifications: { unreadCount: number } | null;
            actionItems: { overdueAssignedCount: number } | null;
            features: { mcp: boolean; integrations: boolean };
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: FlashToast;
            invitationUrl?: string;
            newToken?: NewApiToken;
        };
    }
}
