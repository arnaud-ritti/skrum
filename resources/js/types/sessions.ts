export type JoinSession = {
    title: string;
    facilitatorName: string | null;
    participantsCount: number;
    isLive: boolean;
};

export type RetroJoinSession = JoinSession & { hasAnonymousCards: boolean };

export type GameJoinSession = JoinSession & { gameLabel: string };
