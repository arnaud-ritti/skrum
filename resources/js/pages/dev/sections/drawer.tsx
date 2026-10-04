import { useState } from 'react';
import { BenchOverlayStage } from '@/components/dev/bench';
import { VoteDrawer } from '@/components/skrum/vote-drawer';
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
                <BenchOverlayStage>
                    <VoteDrawer
                        open={voteOpen}
                        onOpenChange={setVoteOpen}
                        deck={deck}
                        value={picked}
                        disabledValues={unavailable}
                        description={t('Story 12: payment retries')}
                        onVote={(card) => {
                            setPicked(card);
                            setVoteOpen(false);
                        }}
                        onRetract={() => {
                            setPicked(null);
                            setVoteOpen(false);
                        }}
                    />
                </BenchOverlayStage>
            </Labelled>
        </div>
    );
}
