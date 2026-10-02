import type { PokerRound } from '@/lib/poker/types';

export type PokerDeckOption = { value: string; label: string; cards: string[] };

export type PokerGameSummary = {
    id: string;
    title: string;
    deckLabel: string;
    tasksCount: number;
    estimatedCount: number;
    totalPoints: number | null;
    endedAt: string | null;
    lastActivityAt: string;
};

export type WhiteboardSummary = {
    id: string;
    title: string;
    updatedAt: string | null;
    facilitatorName: string | null;
    canDelete: boolean;
};

export type WhiteboardPreviewShape = {
    kind: 'rect' | 'ellipse' | 'diamond' | 'path' | 'text';
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string | null;
    stroke: string | null;
    points: [number, number][];
};

export type WhiteboardPreview = {
    width: number;
    height: number;
    shapes: WhiteboardPreviewShape[];
};

export type WhiteboardGalleryItem = {
    key: string;
    workspaceTemplateId: string | null;
    name: string;
    description: string | null;
    preview: WhiteboardPreview;
};

export type WhiteboardTemplateSummary = {
    id: string;
    name: string;
    description: string | null;
    canManage: boolean;
};

export type EstimatedTaskRow = {
    id: string;
    title: string;
    /** The key of the issue an imported task comes from. */
    ticketKey: string | null;
    gameId: string;
    gameTitle: string;
    estimate: string;
    roundsCount: number;
    estimatedAt: string;
    deck: string;
    voters: { name: string; avatarUrl: string }[];
    votersCount: number;
    rounds: PokerRound[];
    players: { id: string; name: string }[];
};

export type SavedPokerDeck = {
    id: string;
    name: string;
    cards: string[];
    scope: 'team' | 'workspace';
    canManage?: boolean;
};

export type BuiltInDeckSummary = {
    key: string;
    name: string;
    cards: string[];
    isDefault: boolean;
    usageCount: number;
};

export type SavedDeckSummary = SavedPokerDeck & {
    canManage: boolean;
    isDefault: boolean;
    usageCount: number;
    createdBy: string | null;
};
