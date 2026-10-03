import type { HealthCheckFormStatement } from '@/components/skrum/health-check-form';
import type {
    RetroCardAuthor,
    RetroCardGif,
    RetroCardInsight,
} from '@/components/skrum/retro-card';
import { childrenOf } from './board-reducer';
import type {
    BoardCard,
    BoardColumn,
    ColumnColor,
    ReactionSummary,
    RetroPhase,
    Snapshot,
} from './types';

/** What the adapters read of a board. */
type BoardView = Pick<
    Snapshot,
    'retro' | 'viewer' | 'columns' | 'cards' | 'participants' | 'writersCount'
>;

/** Phases in which the facilitator may add, rename, recolour, move or delete a column. */
export const ColumnEditPhases: RetroPhase[] = ['icebreaker', 'writing'];

/** Phases in which an author may edit or delete their card. */
const CardEditPhases: RetroPhase[] = ['writing', 'grouping'];

/** Phases in which anyone may name or rename a group. */
export const GroupNamingPhases: RetroPhase[] = [
    'grouping',
    'voting',
    'discussing',
    'actions',
];

/** Phases in which a card takes reactions and comments. */
const CardEngagementPhases: RetroPhase[] = [
    'grouping',
    'voting',
    'discussing',
    'actions',
];

/** Phases in which the vote total of a card shows to everyone. */
export const VoteTotalPhases: RetroPhase[] = [
    'discussing',
    'actions',
    'roti',
    'completed',
];

export const CardMaxLength = 1000;

const GroupNameMaxLength = 60;

const FallbackColor: ColumnColor = 'moss';

type BoardCardProps = {
    id: string;
    text: string | null;
    color: ColumnColor;
    masked: boolean;
    isMine: boolean;
    author: RetroCardAuthor | null;
    gif: RetroCardGif | null;
    insight: RetroCardInsight;
    focused: boolean;
    canEdit: boolean;
    maxLength: number;
};

type BoardColumnProps = {
    id: string;
    title: string;
    color: ColumnColor;
    description: string | null;
    count: number;
    canAdd: boolean;
    canMoveLeft: boolean;
    canMoveRight: boolean;
    /** The facilitator may change the columns in this phase. */
    canManage: boolean;
    /** A column with cards cannot be renamed, recoloured or deleted. */
    hasCards: boolean;
};

type BoardGroupProps = {
    /** The id of the lead card: the server knows a group by it. */
    id: string;
    domId: string;
    /** Empty while the group has no name. */
    title: string;
    color: ColumnColor;
    /** The lead, then the cards grouped under it. */
    cards: BoardCardProps[];
    canEdit: boolean;
    /** A card leaves its group in Grouping only. */
    canUngroup: boolean;
    titleMaxLength: number;
};

/** What a card shows and takes of reactions and comments. */
type CardEngagement = {
    reactions: ReactionSummary[];
    canReact: boolean;
    showsComments: boolean;
    canComment: boolean;
};

/** What a card, or a group through its lead card, shows and takes of votes. */
export type CardVoting = {
    /** `total` is null while the facilitator hides the totals. */
    votes: { total: number | null; mine: number };
    canVote: boolean;
    /** A spent budget adds no vote and still takes one back. */
    canUnvote: boolean;
    /**
     * Why no vote can be added, when none can; the first reason that
     * applies. Having finished voting never blocks (decision 10, B).
     */
    blocked: 'locked' | 'spent' | 'cap' | null;
    /** The cap in force, for the dots of a group; null without one. */
    maxPerCard: number | null;
};

function isBoardEditable(board: Pick<Snapshot, 'retro'>): boolean {
    return !board.retro.isLocked;
}

export function toCardProps(card: BoardCard, board: BoardView): BoardCardProps {
    const column = board.columns.find(
        (candidate) => candidate.id === card.columnId,
    );
    const participant = card.author
        ? board.participants.find(
              (candidate) => candidate.id === card.author?.id,
          )
        : undefined;

    return {
        id: card.id,
        text: card.content,
        color: column?.color ?? FallbackColor,
        masked: card.hidden,
        isMine: card.isMine,
        author: card.author
            ? {
                  id: card.author.id,
                  name: card.author.name,
                  avatarUrl: participant?.avatarUrl ?? null,
              }
            : null,
        gif: card.gif
            ? { previewUrl: card.gif.previewUrl, url: card.gif.url }
            : null,
        insight: { sentiment: card.sentiment, category: card.category },
        focused: board.retro.highlightedCardId === card.id,
        canEdit:
            card.isMine &&
            isBoardEditable(board) &&
            CardEditPhases.includes(board.retro.phase),
        maxLength: CardMaxLength,
    };
}

export function toColumnProps(
    column: BoardColumn,
    board: BoardView,
): BoardColumnProps {
    const index = board.columns.findIndex(
        (candidate) => candidate.id === column.id,
    );
    // Every card, grouped ones included, as the Grouping mockup counts them.
    const columnCards = board.cards.filter(
        (card) => card.columnId === column.id,
    );

    return {
        id: column.id,
        title: column.title,
        color: column.color,
        description: column.description,
        count: columnCards.length,
        canAdd: board.retro.phase === 'writing' && isBoardEditable(board),
        canMoveLeft: index > 0,
        canMoveRight: index !== -1 && index < board.columns.length - 1,
        canManage:
            board.viewer.isFacilitator &&
            ColumnEditPhases.includes(board.retro.phase),
        hasCards: columnCards.length > 0,
    };
}

/**
 * A lead card and the cards grouped under it, as `CardGroup` takes them. A
 * card that leads no other card is not a group.
 */
export function toGroupProps(
    lead: BoardCard,
    board: BoardView,
): BoardGroupProps | null {
    const members = childrenOf(board.cards, lead.id);

    if (lead.parentCardId !== null || members.length === 0) {
        return null;
    }

    const editable = isBoardEditable(board);
    const cards = [lead, ...members].map((card) => toCardProps(card, board));

    return {
        id: lead.id,
        domId: `group-${lead.id}`,
        title: lead.groupName ?? '',
        color: cards[0].color,
        cards,
        canEdit: editable && GroupNamingPhases.includes(board.retro.phase),
        canUngroup: editable && board.retro.phase === 'grouping',
        titleMaxLength: GroupNameMaxLength,
    };
}

/**
 * The votes of a card in Voting. A card inside a group has none: the vote
 * goes to the group, through its lead card.
 */
export function cardVoting(
    card: BoardCard,
    board: Pick<Snapshot, 'retro' | 'viewer'>,
): CardVoting | null {
    if (board.retro.phase !== 'voting') {
        return null;
    }

    if (card.parentCardId !== null || card.hidden) {
        return null;
    }

    const blocked = voteBlock(card, board);

    return {
        votes: { total: card.votes, mine: card.myVotes },
        canVote: blocked === null,
        canUnvote: blocked !== 'locked' && card.myVotes > 0,
        blocked,
        maxPerCard: board.retro.maxVotesPerCard,
    };
}

function voteBlock(
    card: BoardCard,
    board: Pick<Snapshot, 'retro' | 'viewer'>,
): CardVoting['blocked'] {
    if (!isBoardEditable(board)) {
        return 'locked';
    }

    if (board.viewer.remainingVotes <= 0) {
        return 'spent';
    }

    const cap = board.retro.maxVotesPerCard;

    if (cap !== null && card.myVotes >= cap) {
        return 'cap';
    }

    return null;
}

/** The progress of the vote bar: the votes cast, over the votes of everyone. */
export function votingProgress(
    board: Pick<Snapshot, 'retro' | 'participants' | 'votesCast'>,
): { cast: number; total: number } {
    return {
        cast: board.votesCast ?? 0,
        total: board.participants.length * board.retro.votesPerParticipant,
    };
}

/** The counter of the Grouping banner: the groups, and every card. */
export function groupingProgress(board: Pick<Snapshot, 'cards'>): {
    groups: number;
    cards: number;
} {
    const leads = new Set(
        board.cards.flatMap((card) =>
            card.parentCardId === null ? [] : [card.parentCardId],
        ),
    );

    return { groups: leads.size, cards: board.cards.length };
}

export function cardEngagement(
    card: BoardCard,
    board: Pick<Snapshot, 'retro'>,
): CardEngagement {
    if (card.hidden) {
        return {
            reactions: [],
            canReact: false,
            showsComments: false,
            canComment: false,
        };
    }

    const { phase, reactionsEnabled } = board.retro;
    const open = isBoardEditable(board) && CardEngagementPhases.includes(phase);

    return {
        reactions: reactionsEnabled ? card.reactions : [],
        canReact: reactionsEnabled && open,
        showsComments: phase !== 'writing' || card.commentCount > 0,
        canComment: open,
    };
}

/**
 * The counter of the Writing banner: every card, masked ones included, and
 * how many of the people present have written. Someone who wrote and left is
 * still counted, so the total never falls below the writers.
 */
export function writingProgress(
    board: BoardView,
    presentCount: number,
): { cards: number; written: number; present: number } {
    return {
        cards: board.cards.length,
        written: board.writersCount,
        present: Math.max(presentCount, board.writersCount),
    };
}

/**
 * The statements of the health check as the form takes them: the board names
 * nobody and shows no count per statement, only the viewer's own scores.
 */
export function toHealthStatements(
    board: Pick<Snapshot, 'healthCheck'>,
): HealthCheckFormStatement[] {
    return (board.healthCheck?.statements ?? []).map((statement) => ({
        key: statement.key,
        label: statement.label,
        text: statement.text,
        myScore: statement.myScore,
    }));
}
