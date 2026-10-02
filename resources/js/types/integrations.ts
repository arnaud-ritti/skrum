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

type IntegrationStatus = 'active' | 'setup_required' | 'reconnect_required';

export type IntegrationAccess = 'read' | 'write';

type IntegrationAuthMethod = 'oauth' | 'pat';

type JiraSite = { cloudId: string; url: string; name: string };

type JiraField = { id: string; name: string };

type IntegrationSettings = {
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
    serverTitle?: string;
    version?: string;
    baseUrl?: string;
    authMethod?: IntegrationAuthMethod;
    tokenOwner?: string | null;
    tokenSavedAt?: string | null;
    installationId?: string;
    accountLogin?: string;
    accountType?: 'Organization' | 'User';
    exportRepositoryId?: string;
    exportRepositoryName?: string | null;
    priorityLabels?: Partial<Record<PriorityLevel, string | null>>;
    treatCanceledAsDone?: boolean;
    statusMapping?: StatusMapping;
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
    statusSync: boolean;
    inboundMode: InboundMode;
    webhookStatus: WebhookStatus | null;
    lastInboundAt: string | null;
    lastPolledAt: string | null;
    inboundHint: 'reconnect' | 'manual' | null;
};

export type IntegrationProviderCard = {
    provider: IntegrationProviderKey;
    label: string;
    usesOAuth: boolean;
    authMethods: IntegrationAuthMethod[];
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

type DeliveryKind =
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

type WebhookDisabledReason = 'failures' | 'gone';

type WebhookHealth = {
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
    hasContent: boolean;
    redeliverable: boolean;
    redeliveryOf: string | null;
};

export type WebhookDeliveryDetails = {
    id: string;
    event: string | null;
    status: DeliveryStatus;
    attempts: number;
    redeliveryOf: string | null;
    request: { headers: Record<string, string>; body: string | null };
    response: { status: number | null; excerpt: string | null };
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

export type TrackerProviderKey = 'jira' | 'linear' | 'jira_dc' | 'github';

export type PriorityLevel = 'high' | 'medium' | 'low';

type JiraPriorityChoice = { id: string; name: string };

type IntegrationPriorityMap = Partial<
    Record<PriorityLevel, JiraPriorityChoice | number | null>
>;

type InboundMode = 'webhook' | 'polling' | 'off';

type WebhookStatus = 'pending' | 'active' | 'failing';

type JiraStatusMapping = {
    doneStatusIds: string[] | null;
    completeStatusId: string | null;
    reopenStatusId: string | null;
};

type LinearStatusMapping = {
    completeStateId: string | null;
    reopenStateId: string | null;
};

type StatusMapping = {
    projects?: Record<string, JiraStatusMapping>;
    teams?: Record<string, LinearStatusMapping>;
};

export type TrackerStatus = {
    id: string;
    name: string;
    category: 'todo' | 'in_progress' | 'done';
};

export type StatusSyncPageProps = {
    /** How often trackers are polled when webhooks can't be used. */
    pollMinutes: number;
};

export type TrackerWebhookDetails = {
    url: string;
    secret: string;
    events: string[];
    jql: string | null;
};

export type ProviderPriority = { id: string | number; name: string };

export type ExternalAccount = { accountId: string; displayName: string };

export type UserMapping = {
    accountId: string | null;
    displayName: string | null;
    matchedBy: 'email' | 'manual' | 'sso';
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

type ExternalLinkSyncState =
    | 'off'
    | 'synced'
    | 'pending'
    | 'failed'
    | 'missing';

export type ExternalLink = {
    id: string;
    source: TrackerProviderKey;
    key: string;
    url: string;
    state: 'open' | 'done' | null;
    statusName: string | null;
    syncState: ExternalLinkSyncState;
    syncError: string | null;
    lastSyncedAt: string | null;
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
    repositories?: ExportTargetOption[];
    defaults: {
        projectId?: string | null;
        issueTypeId?: string | null;
        teamId?: string | null;
        repositoryId?: string | null;
    };
};

export type ExportPreview = {
    assignee: {
        state: 'mapped' | 'willMatch' | 'guest' | 'never' | 'none';
        displayName: string | null;
    };
    priority: { name: string | null };
};
