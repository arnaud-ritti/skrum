import type { SsoTestResult } from '@/lib/admin/types';
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
            demo: { enabled: boolean; resetTime: string; timezone: string };
            name: string;
            brand: Brand;
            adminUrl: string | null;
            /** Sent to instance admins only, while required single sign-on has no provider. */
            signInAlert: 'sso_required_ignored' | null;
            /** True for instance admins while only single sign-on signs in. */
            ssoInForce: boolean;
            /** Sent to instance admins only: the providers turned on, out of those configured. */
            integrationCounts: { enabled: number; configured: number } | null;
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
            /** Null when signed out or without a current team. */
            liveSessions: { count: number } | null;
            features: { mcp: boolean; integrations: boolean };
            /** Null when signed out. */
            instanceVersion: string | null;
            /** Sent to instance admins only. */
            instanceVersionStatus: {
                state: 'unknown' | 'unreleased' | 'current' | 'outdated';
                latest: string | null;
                checkedAt: string | null;
                releaseUrl: string | null;
            } | null;
            [key: string]: unknown;
        };
        flashDataType: {
            toast?: FlashToast;
            invitationUrl?: string;
            /** How many team invitations were just sent. */
            invitationsSent?: number;
            /** The links of the invitations just sent, on an instance without mail. */
            invitationUrls?: string[];
            newToken?: NewApiToken;
            ssoTest?: SsoTestResult;
        };
    }
}
