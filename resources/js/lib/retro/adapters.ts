import type { HealthCheckFormStatement } from '@/components/skrum/health-check-form';
import type {
    RetroCardAuthor,
    RetroCardGif,
    RetroCardInsight,
} from '@/components/skrum/retro-card';
import { topLevelCards } from './board-reducer';
import type {
    BoardCard,
    BoardColumn,
    ColumnColor,
    RetroPhase,
    Snapshot,
} from './types';

/** What the adapters read of a board. */
export type BoardView = Pick<
    Snapshot,
    'retro' | 'viewer' | 'columns' | 'cards' | 'participants' | 'writersCount'
>;

/** Phases in which the facilitator may add, rename, recolour, move or delete a column. */
export const ColumnEditPhases: RetroPhase[] = [
    'health_check',
    'icebreaker',
    'writing',
];

/** Phases in which an author may edit or delete their card. */
export const CardEditPhases: RetroPhase[] = ['writing', 'grouping'];

export const CardMaxLength = 1000;

const FallbackColor: ColumnColor = 'moss';

export type BoardCardProps = {
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

export type BoardColumnProps = {
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

export function isBoardEditable(board: Pick<Snapshot, 'retro'>): boolean {
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

    return {
        id: column.id,
        title: column.title,
        color: column.color,
        description: column.description,
        count: topLevelCards(board.cards, column.id).length,
        canAdd: board.retro.phase === 'writing' && isBoardEditable(board),
        canMoveLeft: index > 0,
        canMoveRight: index !== -1 && index < board.columns.length - 1,
        canManage:
            board.viewer.isFacilitator &&
            ColumnEditPhases.includes(board.retro.phase),
        hasCards: board.cards.some((card) => card.columnId === column.id),
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
 * The statements of the health check as the form takes them. `answeredBy`
 * holds participant ids; it is empty on an anonymous retro, where only the
 * count is known.
 */
export function toHealthStatements(
    board: Pick<Snapshot, 'healthCheck' | 'participants'>,
): HealthCheckFormStatement[] {
    return (board.healthCheck?.statements ?? []).map((statement) => ({
        key: statement.key,
        label: statement.label,
        text: statement.text,
        myScore: statement.myScore,
        count: statement.count,
        answeredBy: statement.answeredBy.flatMap((id) => {
            const participant = board.participants.find(
                (candidate) => candidate.id === id,
            );

            return participant
                ? [
                      {
                          id: participant.id,
                          name: participant.name,
                          avatarUrl: participant.avatarUrl,
                      },
                  ]
                : [];
        }),
    }));
}
