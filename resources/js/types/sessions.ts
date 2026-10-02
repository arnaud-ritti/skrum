export type JoinSession = {
    title: string;
    facilitatorName: string | null;
    participantsCount: number;
    isLive: boolean;
};

export type GameJoinSession = JoinSession & { gameLabel: string };
