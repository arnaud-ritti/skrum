export type ApiTokenScope = 'mcp:read' | 'mcp:write' | 'mcp:delete';
export type ApiToken = {
    id: string;
    name: string;
    hint: string;
    scopes: ApiTokenScope[];
    team: { id: string; name: string } | null;
    teamAccessible: boolean;
    createdAt: string | null;
    expiresAt: string | null;
    lastUsedAt: string | null;
    isExpired: boolean;
};
export type ApiTokenTeamGroup = {
    workspace: { id: string; name: string };
    teams: { id: string; name: string }[];
};
export type ApiTokenExpiration = '30_days' | '90_days' | '1_year' | 'never';
export type ApiTokenExpirationOption = {
    value: ApiTokenExpiration;
    label: string;
};
export type NewApiToken = { name: string; plainText: string };
