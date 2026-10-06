export const sections = [
    { id: 'getting-started', label: 'Getting started' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'teams', label: 'Workspaces and teams' },
    { id: 'retrospectives', label: 'Retrospectives' },
    { id: 'action-items', label: 'Action items' },
    { id: 'planning-poker', label: 'Planning poker' },
    { id: 'whiteboard', label: 'Whiteboard' },
    { id: 'surveys', label: 'Surveys' },
    { id: 'games', label: 'Games' },
    { id: 'insights', label: 'Team insights' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'mcp', label: 'AI assistants' },
    { id: 'self-hosting', label: 'Self-hosting' },
    { id: 'administration', label: 'Administration' },
    { id: 'reference', label: 'Reference' },
] as const;

export const repository = 'https://github.com/arnaud-ritti/skrum';

export function href(path: string): string {
    return import.meta.env.BASE_URL.replace(/\/$/, '') + path;
}
