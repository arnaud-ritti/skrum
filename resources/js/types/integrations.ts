export type IntegrationProviderKey = 'slack' | 'telegram' | 'jira' | 'linear';

export type IntegrationStatus =
    | 'active'
    | 'setup_required'
    | 'reconnect_required';

export type IntegrationAccess = 'read' | 'write';

export type JiraSite = { cloudId: string; url: string; name: string };

export type JiraField = { id: string; name: string };

export type IntegrationSettings = {
    teamName?: string;
    channelName?: string;
    configurationUrl?: string;
    chatId?: string;
    chatTitle?: string;
    chatType?: string;
    cloudId?: string | null;
    siteName?: string | null;
    siteUrl?: string | null;
    sites?: JiraSite[];
    storyPointFields?: JiraField[];
    numberFields?: JiraField[];
    organizationName?: string;
    urlKey?: string;
};

export type TeamIntegration = {
    id: string;
    provider: IntegrationProviderKey;
    status: IntegrationStatus;
    statusLabel: string;
    access: IntegrationAccess;
    settings: IntegrationSettings;
    connectedBy: string | null;
    connectedAt: string | null;
    lastCheckedAt: string | null;
    lastError: string | null;
};

export type IntegrationProviderCard = {
    provider: IntegrationProviderKey;
    label: string;
    usesOAuth: boolean;
    isTracker: boolean;
    connection: TeamIntegration | null;
};

export type IntegrationScope = { workspace: string; team: string };

export type TelegramBotInfo = { botUsername: string | null; conflict: boolean };

export type TelegramConnectCode = {
    code: string;
    command: string;
    botUsername: string;
    expiresAt: string;
};
