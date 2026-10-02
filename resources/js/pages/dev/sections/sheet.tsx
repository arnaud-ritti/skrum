import { CalendarDays, Flag, User } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetBody,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetProperties,
    SheetProperty,
    SheetTitle,
} from '@/components/ui/sheet';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

type Variant = 'default' | 'late' | 'readonly' | 'left';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-card">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function SheetSection() {
    const { t } = useTrans();
    const [variant, setVariant] = useState<Variant | null>('default');
    const close = (open: boolean) => {
        if (!open) {
            setVariant(null);
        }
    };
    const readonly = variant === 'readonly';

    return (
        <section className="@container grid gap-4 p-4 md:grid-cols-2 md:p-6">
            <State label={t('Sheet: open from the right, sticky footer')}>
                <Button onClick={() => setVariant('default')}>
                    {t('Open the sheet')}
                </Button>
            </State>
            <State label={t('Sheet: overdue due date')}>
                <Button variant="outline" onClick={() => setVariant('late')}>
                    {t('Open with an overdue date')}
                </Button>
            </State>
            <State label={t('Sheet: read only, no footer')}>
                <Button
                    variant="outline"
                    onClick={() => setVariant('readonly')}
                >
                    {t('Open read only')}
                </Button>
            </State>
            <State label={t('Sheet: left side')}>
                <Button variant="outline" onClick={() => setVariant('left')}>
                    {t('Open from the left')}
                </Button>
            </State>
            <Sheet open={variant !== null} onOpenChange={close}>
                <SheetContent side={variant === 'left' ? 'left' : 'right'}>
                    <SheetHeader>
                        <SheetTitle>{t('Action details')}</SheetTitle>
                        <SheetDescription>
                            {t('Edit this action without leaving the board.')}
                        </SheetDescription>
                    </SheetHeader>
                    <SheetBody>
                        <SheetProperties>
                            <SheetProperty label={t('Owner')} icon={<User />}>
                                Ada Lovelace
                            </SheetProperty>
                            <SheetProperty
                                label={t('Due date')}
                                icon={<CalendarDays />}
                            >
                                <span
                                    className={
                                        variant === 'late'
                                            ? 'text-skrum-warning-text'
                                            : undefined
                                    }
                                >
                                    {variant === 'late'
                                        ? t('Overdue since 3 days')
                                        : t('In 5 days')}
                                </span>
                            </SheetProperty>
                            <SheetProperty
                                label={t('Priority')}
                                icon={<Flag />}
                            >
                                {t('High')}
                            </SheetProperty>
                        </SheetProperties>
                        {Array.from({ length: 8 }, (_, index) => (
                            <p
                                key={index}
                                className="text-body-sm text-muted-foreground"
                            >
                                {t('History entry :number', {
                                    number: index + 1,
                                })}
                            </p>
                        ))}
                    </SheetBody>
                    {!readonly && (
                        <SheetFooter>
                            <Button>{t('Save')}</Button>
                            <Button
                                variant="outline"
                                onClick={() => setVariant(null)}
                            >
                                {t('Cancel')}
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </section>
    );
}
