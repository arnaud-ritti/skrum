import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { useTrans } from '@/hooks/use-trans';

function Labelled({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

const deck = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];
const unavailable = ['13'];

export default function DrawerSection() {
    const { t } = useTrans();
    const [voteOpen, setVoteOpen] = useState(true);
    const [plainOpen, setPlainOpen] = useState(false);
    const [picked, setPicked] = useState<string | null>('5');

    return (
        <div className="flex max-w-2xl min-w-0 flex-col gap-8 p-4 md:p-6">
            <Labelled
                label={t(
                    'Open: slides up, handle, close button, drag down to close',
                )}
            >
                <Button
                    className="self-start"
                    variant="outline"
                    onClick={() => setPlainOpen(true)}
                >
                    {t('Open the drawer')}
                </Button>
                <Drawer open={plainOpen} onOpenChange={setPlainOpen}>
                    <DrawerContent closeLabel={t('Close')}>
                        <DrawerHeader>
                            <DrawerTitle>
                                {t('Details of the card')}
                            </DrawerTitle>
                            <DrawerDescription>
                                {t('Story 12: payment retries')}
                            </DrawerDescription>
                        </DrawerHeader>
                        <DrawerFooter>
                            <DrawerClose asChild>
                                <Button variant="ghost">{t('Close')}</Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            </Labelled>
            <Labelled
                label={t(
                    'Vote deck: selected card, special cards, unavailable card',
                )}
            >
                <Button
                    className="self-start"
                    onClick={() => setVoteOpen(true)}
                >
                    {t('Choose a card')}
                </Button>
                <Drawer open={voteOpen} onOpenChange={setVoteOpen}>
                    <DrawerContent closeLabel={t('Close')}>
                        <DrawerHeader>
                            <DrawerTitle>{t('Your estimate')}</DrawerTitle>
                            <DrawerDescription>
                                {t('Pick one card, you can change it later')}
                            </DrawerDescription>
                        </DrawerHeader>
                        <div
                            role="radiogroup"
                            aria-label={t('Estimate')}
                            className="grid grid-cols-5 justify-items-center gap-2"
                        >
                            {deck.map((card) => {
                                const special = card === '?' || card === '☕';
                                const isPicked = picked === card;
                                const isUnavailable =
                                    unavailable.includes(card);

                                return (
                                    <button
                                        key={card}
                                        type="button"
                                        role="radio"
                                        aria-checked={isPicked}
                                        aria-label={t(':card points', { card })}
                                        disabled={isUnavailable}
                                        onClick={() => setPicked(card)}
                                        className={`flex h-14 w-11 items-center justify-center rounded-xl border text-base font-semibold transition-transform duration-(--duration-base) ease-(--ease-spring) focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-hidden disabled:opacity-40 ${
                                            isPicked
                                                ? '-translate-y-2.5 bg-skrum-primary-soft text-skrum-primary-text ring-2 ring-primary'
                                                : special
                                                  ? 'bg-muted'
                                                  : 'bg-card'
                                        }`}
                                    >
                                        {card}
                                    </button>
                                );
                            })}
                        </div>
                        <DrawerFooter>
                            <Button
                                className="h-11 w-full"
                                onClick={() => setVoteOpen(false)}
                            >
                                {t('Vote')}
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setPicked(null);
                                    setVoteOpen(false);
                                }}
                            >
                                {t('Retract my vote')}
                            </Button>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            </Labelled>
        </div>
    );
}
