import { PlusIcon, SmileIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

const emojis = [
    '👍',
    '❤️',
    '🎉',
    '😂',
    '🤔',
    '👀',
    '🙌',
    '🔥',
    '💡',
    '✅',
    '🚀',
    '😅',
];

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

/* Two popovers stay open together only when neither takes the focus from the other. */
function keepFocus(event: Event): void {
    event.preventDefault();
}

export default function PopoverSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Popover open (trigger with ring)')}>
                <div className="flex min-h-40 items-start">
                    <Popover defaultOpen>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                <PlusIcon aria-hidden="true" />
                                <span className="truncate">
                                    {t('Add time')}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            onOpenAutoFocus={keepFocus}
                        >
                            <p className="text-sm">
                                {t('Add one minute to the timer?')}
                            </p>
                        </PopoverContent>
                    </Popover>
                </div>
            </Example>
            <Example
                label={t('Popover with emoji grid (padding 8, 6 columns)')}
            >
                <div className="flex min-h-40 items-start">
                    <Popover defaultOpen>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="icon">
                                <SmileIcon aria-hidden="true" />
                                <span className="sr-only">{t('React')}</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="start"
                            className="grid grid-cols-6 gap-1 p-2"
                            onOpenAutoFocus={keepFocus}
                        >
                            {emojis.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className="flex size-9 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-hidden"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>
            </Example>
            <Example label={t('Tooltip open on top (default)')}>
                <div className="flex min-h-20 items-end px-16">
                    <Tooltip open>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon">
                                <PlusIcon aria-hidden="true" />
                                <span className="sr-only">{t('Add time')}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('Add time')}</TooltipContent>
                    </Tooltip>
                </div>
            </Example>
            <Example label={t('Tooltip open below')}>
                <div className="flex min-h-20 items-start px-16">
                    <Tooltip open>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon">
                                <PlusIcon aria-hidden="true" />
                                <span className="sr-only">{t('Add time')}</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {t('Add time')}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </Example>
            <Example label={t('Tooltip open with keyboard shortcut')}>
                <div className="flex min-h-20 items-end px-16">
                    <Tooltip open>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon">
                                <PlusIcon aria-hidden="true" />
                                <span className="sr-only">
                                    {t('Next phase')}
                                </span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent shortcut={['⌘', '→']}>
                            {t('Next phase')}
                        </TooltipContent>
                    </Tooltip>
                </div>
            </Example>
            <Example label={t('Kbd and KbdGroup')}>
                <KbdGroup>
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                </KbdGroup>
            </Example>
        </div>
    );
}
