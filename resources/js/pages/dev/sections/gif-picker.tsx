import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { GifPicker } from '@/components/skrum/gif-picker';
import type { GifItem } from '@/components/skrum/gif-picker';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function State({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

const noop = (): void => {};

export default function GifPickerSection() {
    const { t } = useTrans();
    const lang =
        typeof document === 'undefined' ? 'en' : document.documentElement.lang;
    const [selectedId, setSelectedId] = useState<string | undefined>();
    const [sent, setSent] = useState<string | null>(null);
    const [open, setOpen] = useState(true);

    const samples: [string, number, number][] = [
        [t('This is fine dog'), 2400, 120],
        [t('Happy dance'), 1800, 84],
        [t('Tired Monday cat'), 3100, 100],
        [t('Mind blown'), 2000, 128],
        [t('Coffee time'), 1200, 88],
        [t('Running late'), 2700, 108],
        [t('High five team'), 1600, 92],
        [t('Victory fist pump'), 2200, 112],
    ];
    const results: GifItem[] = samples.map(
        ([title, durationMs, height], index) => ({
            id: `sample-${index}`,
            previewUrl: '',
            title,
            durationMs,
            width: 200,
            height,
        }),
    );
    const proxied = (count: number): GifItem[] =>
        Array.from({ length: count }, (_, index) => ({
            id: `proxied-${index}`,
            previewUrl: '',
            width: 200,
            height: 84 + ((index * 17) % 48),
        }));

    return (
        <div className="grid max-w-240 grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] items-start gap-6 p-4 md:p-6">
            <State label={t('Default: trending, hover a tile for its title')}>
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion={false}
                    results={results}
                    selectedId={selectedId}
                    onOpenChange={noop}
                    onSelect={(gif) => setSelectedId(gif.id)}
                />
            </State>
            <State
                label={t(
                    'Open on a stage: no focus taken, as wide as its container',
                )}
            >
                <GifPicker
                    open
                    inline
                    lang={lang}
                    reducedMotion={false}
                    results={results}
                    selectedId={selectedId}
                    onOpenChange={noop}
                    onSelect={(gif) => setSelectedId(gif.id)}
                />
            </State>
            <State label={t('Loading: skeletons')}>
                <GifPicker
                    open
                    lang={lang}
                    status="loading"
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Empty search with suggestions')}>
                <GifPicker
                    open
                    lang={lang}
                    status="empty"
                    initialQuery="zzkrum standup"
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Error: provider unreachable')}>
                <GifPicker
                    open
                    lang={lang}
                    status="error"
                    initialQuery={t('deadline')}
                    onRetry={noop}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Error: too many searches')}>
                <GifPicker
                    open
                    lang={lang}
                    status="rate_limited"
                    initialQuery={t('deadline')}
                    onRetry={noop}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Proxy data today: no title, no duration')}>
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion={false}
                    results={proxied(6)}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('No result yet (0 items)')}>
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion={false}
                    results={[]}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('200 results, scrolls')}>
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion={false}
                    results={proxied(200)}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Search results, one GIF selected')}>
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion={false}
                    initialQuery={t('tired')}
                    results={results}
                    selectedId="sample-2"
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State
                label={
                    sent === null
                        ? t(
                              'Preview before sending: pick a GIF, caption up to 60 characters',
                          )
                        : t('Sent: :title', { title: sent })
                }
            >
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion={false}
                    withCaption
                    results={results}
                    onOpenChange={noop}
                    onSelect={(gif, caption) =>
                        setSent(
                            caption
                                ? `${gif.title ?? gif.id} (${caption})`
                                : (gif.title ?? gif.id),
                        )
                    }
                />
            </State>
            <State label={t('Reduced motion: stills with a play button')}>
                <GifPicker
                    open
                    lang={lang}
                    reducedMotion
                    results={results}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Disabled by the admin')}>
                <GifPicker
                    open
                    lang={lang}
                    status="disabled"
                    onNotifyAdmin={noop}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('Tenor provider, rated PG')}>
                <GifPicker
                    open
                    lang={lang}
                    provider="tenor"
                    rating="pg"
                    reducedMotion={false}
                    results={results.slice(0, 4)}
                    onOpenChange={noop}
                    onSelect={noop}
                />
            </State>
            <State label={t('One result, long title, 20rem container')}>
                <div className="w-80 max-w-full">
                    <GifPicker
                        open
                        lang={lang}
                        reducedMotion={false}
                        initialQuery={t('victory')}
                        results={[
                            {
                                ...results[0],
                                id: 'long',
                                title: t(
                                    'The whole team celebrating the end of a very long sprint together',
                                ),
                            },
                        ]}
                        selectedId="long"
                        onOpenChange={noop}
                        onSelect={noop}
                    />
                </div>
            </State>
            <State label={t('Closes on Escape, reopens empty')}>
                <div className="flex flex-col items-start gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOpen((current) => !current)}
                    >
                        <span className="truncate">{t('Choose my GIF')}</span>
                    </Button>
                    <GifPicker
                        open={open}
                        lang={lang}
                        reducedMotion={false}
                        withCaption
                        results={results}
                        onOpenChange={setOpen}
                        onSelect={() => setOpen(false)}
                    />
                </div>
            </State>
        </div>
    );
}
