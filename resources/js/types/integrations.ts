export type IntegrationProviderKey =
    | 'slack'
    | 'telegram'
    | 'jira'
    | 'linear'
    | 'jira_dc'
    | 'github'
    | 'msteams'
    | 'mattermost'
    | 'webhook';

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
    priorityMap?: IntegrationPriorityMap;
    host?: string;
    channelLabel?: string | null;
    secretCreatedAt?: string;
    events?: WebhookEventName[];
    disabledReason?: WebhookDisabledReason;
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
    webhook: WebhookHealth | null;
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

export type MattermostServerInfo = { url: string };

export type TelegramConnectCode = {
    code: string;
    command: string;
    botUsername: string;
    expiresAt: string;
};

export type ShareChannel =
    | 'slack'
    | 'telegram'
    | 'msteams'
    | 'mattermost'
    | 'webhook';

export type DeliveryChannel = ShareChannel | 'email';

export type DeliveryKind =
    | 'retro_link'
    | 'poker_link'
    | 'retro_results'
    | 'game_room_link';

export type DeliveryStatus = 'queued' | 'sent' | 'failed';

export type WebhookEventName =
    | 'retro.completed'
    | 'action_item.created'
    | 'action_item.completed'
    | 'action_item.reopened'
    | 'poker.task.estimated';

export type WebhookEventOption = {
    name: WebhookEventName;
    description: string;
};

export type WebhookDisabledReason = 'failures' | 'gone';

export type WebhookHealth = {
    consecutiveFailures: number;
    lastDeliverySucceededAt: string | null;
};

export type WebhookDelivery = {
    id: string;
    event: string | null;
    kind: string;
    status: DeliveryStatus;
    attempts: number;
    responseStatus: number | null;
    error: string | null;
    createdAt: string | null;
    lastAttemptAt: string | null;
};

export type WebhookDeliveryPage = {
    data: WebhookDelivery[];
    currentPage: number;
    lastPage: number;
    total: number;
};

export type ConnectedWebhook = TeamIntegration & { secret: string };

export type IntegrationDelivery = {
    id: string;
    channel: DeliveryChannel;
    kind: DeliveryKind;
    status: DeliveryStatus;
    error: string | null;
    sentAt: string | null;
    createdAt: string | null;
    requestedBy: string | null;
    recipientCount: number | null;
};

export type ShareAvailability = Record<ShareChannel, boolean>;

export type RetroResultsAudience = 'participants' | 'team';

export type TrackerProviderKey = 'jira' | 'linear';

export type PriorityLevel = 'high' | 'medium' | 'low';

export type JiraPriorityChoice = { id: string; name: string };

export type IntegrationPriorityMap = Partial<
    Record<PriorityLevel, JiraPriorityChoice | number | null>
>;

export type ProviderPriority = { id: string | number; name: string };

export type ExternalAccount = { accountId: string; displayName: string };

export type UserMapping = {
    accountId: string | null;
    displayName: string | null;
    matchedBy: 'email' | 'manual';
    accountInactive: boolean;
};

export type UserMappingRow = {
    userId: string;
    name: string;
    email: string;
    avatarUrl: string;
    mapping: UserMapping | null;
};

export type UserMappings = { members: UserMappingRow[]; matching: boolean };

export type ExternalLink = {
    source: TrackerProviderKey;
    key: string;
    url: string;
};

export type ExportSource = {
    source: TrackerProviderKey;
    label: string;
    integrationId: string;
};

export type ExportWarning = { code: string; message: string | null };

export type ExportTargetOption = { id: string; key?: string; name: string };

export type ExportTargets = {
    projects?: ExportTargetOption[];
    issueTypes?: ExportTargetOption[];
    teams?: ExportTargetOption[];
    defaults: {
        projectId?: string | null;
        issueTypeId?: string | null;
        teamId?: string | null;
    };
};

export type ExportPreview = {
    assignee: {
        state: 'mapped' | 'willMatch' | 'guest' | 'never' | 'none';
        displayName: string | null;
    };
    priority: { name: string | null };
};
