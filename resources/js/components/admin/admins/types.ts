export type InstanceAdmin = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    isSelf: boolean;
    canRevoke: boolean;
};

export type AdminCandidate = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
};

export type CandidateSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export const CandidateQueryMinLength = 2;
