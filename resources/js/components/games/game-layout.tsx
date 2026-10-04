import type { LucideIcon } from 'lucide-react';
import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useRestoreFocus } from '@/components/ui/use-restore-focus';
import { cn } from '@/lib/utils';
import { useMinWidthRem } from './use-min-width-rem';

export type GameLayoutPanel = {
    /** Stable across games, so an open sheet follows its panel when the game changes. */
    id: string;
    /** Names the column, the button that opens the sheet, and the sheet. */
    label: string;
    icon: LucideIcon;
    content: ReactNode;
};

export type GameLayoutProps = {
    /**
     * Which mockup the columns follow: the game choice on the left (Hangman),
     * or the players on the left and what the game adds on the right.
     */
    variant?: 'choice' | 'players';
    left?: GameLayoutPanel;
    stage: ReactNode;
    right?: GameLayoutPanel;
    /** Only ever in a sheet: the game choice where the players hold the left column. */
    chooser?: GameLayoutPanel;
    /** Stands above the stage for the panel `summaryFor` names, while that panel is in a sheet. */
    summary?: ReactNode;
    summaryFor?: string;
    /** Bottom centre of the stage, never over it: the reaction bar. */
    dock?: ReactNode;
    className?: string;
};

const RightColumnFromRem = 64;

/** False where the right column is a sheet: what a game needs at hand then stands on the stage. */
export function useHasRightColumn(): boolean {
    return useMinWidthRem(RightColumnFromRem);
}
const LeftColumnFromRem = 80;
const PhoneUnderRem = 48;

/** True under the width of a phone, where a column's extras fold into the stage. */
export function useIsPhone(): boolean {
    return !useMinWidthRem(PhoneUnderRem);
}

/** False where the left column is a sheet: the stage of a retro shows the game cards to a player only beside the stage. */
export function useHasLeftColumn(): boolean {
    return useMinWidthRem(LeftColumnFromRem);
}

const StageFooterContext = createContext<HTMLElement | null>(null);

/**
 * Where a game docks what the thumb needs, at the bottom of the screen of a
 * phone: the hangman keyboard, the guess field of a drawing. Null on a wider
 * screen and outside a `GameLayout`: the game keeps it in its flow then.
 */
export function useStageFooter(): HTMLElement | null {
    return useContext(StageFooterContext);
}

/** The inset of the home indicator stands under a docked panel, in its own colour. */
export const dockedPanelClass =
    'border-t pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]';

const columns = {
    choice: {
        both: 'grid-cols-[21.25rem_minmax(0,1fr)_20rem]',
        left: 'grid-cols-[21.25rem_minmax(0,1fr)]',
        right: 'grid-cols-[minmax(0,1fr)_20rem]',
    },
    players: {
        both: 'grid-cols-[18.75rem_minmax(0,1fr)_21.25rem]',
        left: 'grid-cols-[18.75rem_minmax(0,1fr)]',
        right: 'grid-cols-[minmax(0,1fr)_21.25rem]',
    },
};

function gridColumnsFor(
    variant: keyof typeof columns,
    hasLeftColumn: boolean,
    hasRightColumn: boolean,
): string {
    if (hasLeftColumn && hasRightColumn) {
        return columns[variant].both;
    }

    if (hasLeftColumn) {
        return columns[variant].left;
    }

    if (hasRightColumn) {
        return columns[variant].right;
    }

    return 'grid-cols-1';
}

type SheetPanel = GameLayoutPanel & { side: 'left' | 'right' };

/** The three columns of a game, without a topbar: a room and the retro stage share it. */
export function GameLayout({
    variant = 'choice',
    left,
    stage,
    right,
    chooser,
    summary,
    summaryFor,
    dock,
    className,
}: GameLayoutProps) {
    const isWideForRight = useMinWidthRem(RightColumnFromRem);
    const isWideForLeft = useMinWidthRem(LeftColumnFromRem);
    const [panelId, setPanelId] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const isPhone = useIsPhone();
    const [footer, setFooter] = useState<HTMLElement | null>(null);

    const hasLeftColumn = left !== undefined && isWideForLeft;
    const hasRightColumn = right !== undefined && isWideForRight;
    const leftInSheet = left !== undefined && !isWideForLeft;
    const rightInSheet = right !== undefined && !isWideForRight;
    const hasBar = leftInSheet || rightInSheet;

    const leftSheet: SheetPanel[] = leftInSheet
        ? [{ ...left, side: 'left' }]
        : [];
    const rightSheet: SheetPanel[] = rightInSheet
        ? [{ ...right, side: 'right' }]
        : [];
    /** The players first, the game choice last. */
    const sheetPanels: SheetPanel[] = [
        ...(variant === 'players'
            ? [...leftSheet, ...rightSheet]
            : [...rightSheet, ...leftSheet]),
        ...(chooser ? [{ ...chooser, side: 'left' as const }] : []),
    ];
    const active = sheetPanels.find((panel) => panel.id === panelId);
    const isSheetOpen = isPanelOpen && active !== undefined;
    const lastActive = useRef<SheetPanel | undefined>(undefined);

    if (active !== undefined) {
        lastActive.current = active;
    }

    /** A sheet whose panel left closes for good, and keeps what it showed while it slides out. */
    const shown = active ?? lastActive.current;

    if (isPanelOpen && active === undefined) {
        setIsPanelOpen(false);
    }
    const restoreFocus = useRestoreFocus(isSheetOpen);
    const hasSummary =
        summaryFor !== undefined &&
        sheetPanels.some((panel) => panel.id === summaryFor);

    const open = (id: string) => {
        setPanelId(id);
        setIsPanelOpen(true);
    };

    const gridColumns = gridColumnsFor(variant, hasLeftColumn, hasRightColumn);

    return (
        <div
            data-slot="game-layout"
            data-variant={variant}
            className={cn('grid h-full min-h-0', gridColumns, className)}
        >
            {hasLeftColumn && (
                <aside
                    data-slot="game-left"
                    aria-label={left.label}
                    className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto border-r bg-card p-5"
                >
                    {left.content}
                    {chooser && (
                        <Button
                            type="button"
                            variant="outline"
                            data-slot="game-chooser"
                            className="mt-auto w-full min-w-0 shrink-0"
                            onClick={() => open(chooser.id)}
                        >
                            <chooser.icon aria-hidden />
                            <span className="truncate">{chooser.label}</span>
                        </Button>
                    )}
                </aside>
            )}
            <div
                data-slot="game-stage"
                className="flex min-h-0 min-w-0 flex-col bg-skrum-canvas"
            >
                {hasBar && (
                    <div
                        data-slot="game-bar"
                        className="flex shrink-0 items-center gap-2 border-b bg-background px-4 py-2"
                    >
                        <div className="min-w-0 flex-1">
                            {hasSummary && summary}
                        </div>
                        {sheetPanels.map((panel) => (
                            <Button
                                key={panel.id}
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={panel.label}
                                onClick={() => open(panel.id)}
                            >
                                <panel.icon aria-hidden />
                            </Button>
                        ))}
                    </div>
                )}
                <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-5 sm:px-8">
                    <StageFooterContext value={isPhone ? footer : null}>
                        {stage}
                    </StageFooterContext>
                </div>
                {dock !== undefined && dock !== null && (
                    <div
                        data-slot="game-dock"
                        className="flex shrink-0 justify-center px-2 pb-3"
                    >
                        {dock}
                    </div>
                )}
                {isPhone && (
                    <div
                        ref={setFooter}
                        data-slot="game-footer"
                        className="shrink-0 empty:hidden"
                    />
                )}
            </div>
            {hasRightColumn && (
                <aside
                    data-slot="game-right"
                    aria-label={right.label}
                    className="flex min-h-0 min-w-0 flex-col gap-5 overflow-y-auto border-l bg-card p-5"
                >
                    {right.content}
                </aside>
            )}
            <Sheet
                open={isSheetOpen}
                onOpenChange={(next) => {
                    if (!next) {
                        setIsPanelOpen(false);
                    }
                }}
            >
                <SheetContent
                    side={shown?.side ?? 'right'}
                    aria-describedby={undefined}
                    onCloseAutoFocus={restoreFocus}
                >
                    <SheetHeader>
                        <SheetTitle>{shown?.label}</SheetTitle>
                    </SheetHeader>
                    <SheetBody className="flex flex-col gap-5 space-y-0">
                        {shown?.content}
                    </SheetBody>
                </SheetContent>
            </Sheet>
        </div>
    );
}
