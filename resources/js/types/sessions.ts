import type { GameOption } from '@/lib/games/types';
import type { PokerTrackerSourceRow } from '@/lib/poker/types';
import type {
    SurveyTemplateOption,
    TeamSurveySummary,
} from '@/lib/surveys/types';
import type {
    PokerDeckOption,
    SavedPokerDeck,
    WhiteboardGalleryItem,
} from './poker';
import type {
    CatalogueTemplate,
    CategoryOption,
    LlmAvailability,
} from './workspaces';

export type JoinSession = {
    title: string;
    facilitatorName: string | null;
    participantsCount: number;
    isLive: boolean;
};

export type RetroJoinSession = JoinSession & { hasAnonymousCards: boolean };

export type GameJoinSession = JoinSession & { gameLabel: string };

/** The props of the "New session" dialog: `PresentNewSessionOptions`. */
export type NewSessionOptions = {
    templateCategories: CategoryOption[];
    topTemplates: string[];
    /** Optional: asked for when the full template picker opens. */
    catalogue?: CatalogueTemplate[];
    llm: LlmAvailability;
    canCreateRetro: boolean;
    icebreakerGames: GameOption[];
    gameOptions: GameOption[];
    canCreateGameRoom: boolean;
    roomLimit: number;
    pokerDecks: SavedPokerDeck[];
    defaultPokerDeck: { deck: string | null; savedDeckId: string | null };
    pokerDeckOptions: PokerDeckOption[];
    canCreatePokerGame: boolean;
    pokerSources: PokerTrackerSourceRow[];
    canCreateWhiteboard: boolean;
    /** Optional: asked for when the whiteboard gallery opens. */
    whiteboardGallery?: WhiteboardGalleryItem[];
    surveys: TeamSurveySummary[];
    canCreateSurvey: boolean;
    surveyTemplates: SurveyTemplateOption[];
};
