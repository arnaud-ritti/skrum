import { Link, usePage } from '@inertiajs/react';
import {
    ChartColumn,
    Check,
    CircleAlert,
    Eye,
    Send,
    Undo2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import type { SaveState } from '@/lib/surveys/builder-state';
import type { SurveyStatus } from '@/lib/surveys/types';

const ClockTickMs = 5000;

export type BuilderTopbarProps = {
    status: SurveyStatus;
    saveState: SaveState;
    questionCount: number;
    hasAnswers: boolean;
    resultsHref: string;
    busy: boolean;
    /** Absent until the participant view can be shown here: the button is then disabled. */
    onPreview: (() => void) | undefined;
    onPublish: () => void;
    onBackToDraft: () => void;
    /** The Share trigger, once the survey is open. */
    share?: ReactNode;
};

function elapsed(at: number, now: number, locale: string): string {
    const seconds = Math.max(0, Math.round((now - at) / 1000));
    const [value, unit] =
        seconds < 60
            ? [seconds, 'second']
            : seconds < 3600
              ? [Math.floor(seconds / 60), 'minute']
              : [Math.floor(seconds / 3600), 'hour'];

    return new Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay: 'short',
    }).format(value);
}

function useNow(enabled: boolean): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (!enabled) {
            return;
        }

        setNow(Date.now());

        const timer = setInterval(() => setNow(Date.now()), ClockTickMs);

        return () => clearInterval(timer);
    }, [enabled]);

    return now;
}

function SaveStatus({ state }: { state: SaveState }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const now = useNow(state.status === 'saved');

    const content = (() => {
        switch (state.status) {
            case 'idle':
                return null;
            case 'saving':
                return (
                    <>
                        <Spinner aria-hidden className="size-3.5" />
                        {t('Saving…')}
                    </>
                );
            case 'saved':
                return (
                    <>
                        <Check aria-hidden className="size-3.5" />
                        {t('Saved :time ago', {
                            time: elapsed(
                                state.at,
                                Math.max(now, state.at),
                                locale ?? 'en',
                            ),
                        })}
                    </>
                );
            case 'error':
                return (
                    <>
                        <CircleAlert aria-hidden className="size-3.5" />
                        {t('Not saved')}
                    </>
                );
        }
    })();

    return (
        <span
            role="status"
            data-save-state={state.status}
            className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground data-[save-state=error]:text-skrum-destructive-text max-md:sr-only"
        >
            {content}
        </span>
    );
}

function StatusBadge({ status }: { status: SurveyStatus }) {
    const { t } = useTrans();

    switch (status) {
        case 'draft':
            return <Badge variant="muted">{t('Draft')}</Badge>;
        case 'open':
            return <Badge variant="success">{t('Open')}</Badge>;
        case 'closed':
            return <Badge variant="outline">{t('Closed')}</Badge>;
    }
}

/** The builder's part of the application top bar: the status, the save state and the actions. */
export function BuilderTopbar({
    status,
    saveState,
    questionCount,
    hasAnswers,
    resultsHref,
    busy,
    onPreview,
    onPublish,
    onBackToDraft,
    share,
}: BuilderTopbarProps) {
    const { t } = useTrans();
    const isDraft = status === 'draft';
    const canBackToDraft = status === 'open' && !hasAnswers;

    return (
        <div
            data-slot="survey-builder-topbar"
            className="flex min-w-0 items-center gap-2"
        >
            <StatusBadge status={status} />
            <SaveStatus state={saveState} />
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={onPreview === undefined}
                onClick={onPreview}
                aria-label={t('Preview')}
            >
                <Eye aria-hidden />
                <span className="max-md:sr-only">{t('Preview')}</span>
            </Button>
            {canBackToDraft && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={onBackToDraft}
                    aria-label={t('Back to draft')}
                >
                    <Undo2 aria-hidden />
                    <span className="max-md:sr-only">{t('Back to draft')}</span>
                </Button>
            )}
            {isDraft ? (
                <Button
                    type="button"
                    size="sm"
                    disabled={busy || questionCount === 0}
                    onClick={onPublish}
                    aria-label={t('Publish')}
                >
                    <Send aria-hidden />
                    <span className="max-md:sr-only">{t('Publish')}</span>
                </Button>
            ) : (
                <Button asChild size="sm">
                    <Link href={resultsHref} aria-label={t('View results')}>
                        <ChartColumn aria-hidden />
                        <span className="max-md:sr-only">
                            {t('View results')}
                        </span>
                    </Link>
                </Button>
            )}
            {!isDraft && share}
        </div>
    );
}
