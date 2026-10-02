import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

/**
 * The password form of the login page while single sign-on is required:
 * folded, and offered to every visitor, because the page cannot know who is
 * an administrator.
 */
export function AdminSignInDisclosure({ children }: { children: ReactNode }) {
    const { t } = useTrans();
    const regionId = useId();
    const region = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (open) {
            region.current?.querySelector<HTMLElement>('input')?.focus();
        }
    }, [open]);

    return (
        <div data-slot="admin-sign-in" className="flex min-w-0 flex-col gap-4">
            <Button
                type="button"
                variant="ghost"
                className="w-full min-w-0"
                aria-expanded={open}
                aria-controls={regionId}
                data-test="admin-sign-in-button"
                onClick={() => setOpen((isOpen) => !isOpen)}
            >
                <span className="truncate">{t('Administrator sign-in')}</span>
                <ChevronDown
                    aria-hidden="true"
                    data-open={open ? '' : undefined}
                    className="transition-transform duration-140 ease-standard data-[open]:rotate-180 motion-reduce:transition-none"
                />
            </Button>
            <div
                ref={region}
                id={regionId}
                hidden={!open}
                className="flex min-w-0 flex-col gap-4"
            >
                {open && (
                    <>
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Administrators can sign in with their password and a second factor.',
                            )}
                        </p>
                        {children}
                    </>
                )}
            </div>
        </div>
    );
}
