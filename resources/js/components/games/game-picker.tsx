import { useState } from 'react';
import type { ReactNode } from 'react';
import GameSwitchesController from '@/actions/App/Http/Controllers/Games/GameSwitchesController';
import {
    IcebreakerGameCard,
    IcebreakerGameGrid,
} from '@/components/skrum/icebreaker-game-card';
import { useTrans } from '@/hooks/use-trans';
import { GameCatalogue } from '@/lib/games/catalogue';
import type { GameKind } from '@/lib/games/types';
import { retroRequest } from '@/lib/retro/api';
import { useRoom } from './room-context';

type GamePickerProps = {
    /** Place left under the game cards for the settings card of a game (GM-1). */
    settings?: ReactNode;
    /** For a player of a retro's icebreaker: the cards tell the game in play, the facilitator chooses. */
    readOnly?: boolean;
    /** In a retro's icebreaker, where nobody is called a host. */
    inRetro?: boolean;
};

/**
 * The columns of a room change with the game, and the card or the sheet the
 * host switched from may be gone: the keyboard goes to the game in play where
 * the cards have a column, else to "Choose a game", else to the stage.
 */
function focusAfterSwitch(): void {
    const column = document.querySelector('[data-slot="game-left"]');
    const inPlay = column?.querySelector<HTMLElement>(
        '[data-slot="icebreaker-game-card"][data-selected="true"]',
    );

    if (inPlay) {
        inPlay.focus();

        return;
    }

    const focused = document.activeElement;

    if (focused instanceof HTMLElement && focused !== document.body) {
        return;
    }

    const chooser = column?.querySelector<HTMLElement>(
        '[data-slot="game-chooser"]',
    );

    (chooser ?? document.getElementById('game-stage-title'))?.focus();
}

/**
 * The host's choice of game, one card per game the server lists. Switching
 * mid-round abandons the round for everyone (spec §4).
 */
export function GamePicker({
    settings,
    readOnly = false,
    inRetro = false,
}: GamePickerProps) {
    const ctx = useRoom();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { room, games } = ctx.snapshot;
    const hostSubtitle = inRetro
        ? t('You choose the game, everyone plays.')
        : t('The host starts, everyone plays.');

    const change = async (game: GameKind) => {
        if (readOnly || busy || game === room.game) {
            return;
        }

        setBusy(true);

        try {
            const result = await ctx.run(
                retroRequest(GameSwitchesController.update(room.id), { game }),
            );

            if (result !== undefined) {
                await ctx.refetch();
                requestAnimationFrame(focusAfterSwitch);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            data-slot="game-picker"
            className="flex min-h-0 flex-1 flex-col gap-4"
        >
            <div className="flex flex-col gap-1">
                <h2 className="text-base font-title">
                    {readOnly ? t('Games') : t('Choose a game')}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {readOnly
                        ? t('The facilitator chooses the game.')
                        : hostSubtitle}
                </p>
            </div>
            <IcebreakerGameGrid className="grid-cols-2 gap-3 sm:grid-cols-2">
                {games.map((option) => (
                    <IcebreakerGameCard
                        key={option.value}
                        {...GameCatalogue[option.value]}
                        game={option.value}
                        title={option.label}
                        compact
                        available={option.available}
                        unavailableReason={
                            option.value === 'guess_who'
                                ? t('Not in an anonymous retro')
                                : undefined
                        }
                        selected={option.value === room.game}
                        inPlay
                        readOnly={readOnly}
                        onSelect={(game) => void change(game)}
                    />
                ))}
            </IcebreakerGameGrid>
            {settings !== undefined && (
                <>
                    <span className="flex-1" />
                    {settings}
                </>
            )}
        </div>
    );
}
