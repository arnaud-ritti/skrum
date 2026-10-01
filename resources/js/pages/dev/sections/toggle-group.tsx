import {
    Bold,
    CalendarClock,
    Columns3,
    Eye,
    EyeOff,
    Italic,
    LayoutGrid,
    Link,
    List,
    Monitor,
    Moon,
    Strikethrough,
    Sun,
    Ticket,
    UserRound,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'ui';

function Cell({
    label,
    children,
    wide = false,
}: {
    label: string;
    children: ReactNode;
    wide?: boolean;
}) {
    return (
        <div
            className={`flex min-w-0 flex-col items-start gap-2 ${wide ? 'col-span-full' : ''}`}
        >
            <p className="text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

function Captioned({
    caption,
    children,
}: {
    caption: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col items-start gap-1">
            {children}
            <span className="text-xs text-muted-foreground">{caption}</span>
        </div>
    );
}

export default function ToggleGroupSection() {
    const { t } = useTrans();
    const [formatting, setFormatting] = useState<string[]>(['bold', 'list']);
    const [filters, setFilters] = useState<string[]>(['mine', 'overdue']);
    const [view, setView] = useState('columns');
    const [period, setPeriod] = useState('30d');
    const [theme, setTheme] = useState('dark');
    const [authors, setAuthors] = useState('hidden');
    const [lockedFormatting] = useState<string[]>(['italic']);

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17.5rem),1fr))] gap-x-6 gap-y-8 p-4 md:p-6">
            <Cell label={t('Toggle · off, on, disabled')} wide>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                    <Captioned caption={t('Off')}>
                        <Toggle icon={EyeOff}>{t('Hide tasks')}</Toggle>
                    </Captioned>
                    <Captioned caption={t('On')}>
                        <Toggle icon={EyeOff} defaultPressed>
                            {t('Hide tasks')}
                        </Toggle>
                    </Captioned>
                    <Captioned caption={t('Disabled')}>
                        <Toggle icon={EyeOff} disabled>
                            {t('Hide tasks')}
                        </Toggle>
                    </Captioned>
                    <Captioned caption={t('Disabled and on')}>
                        <Toggle icon={EyeOff} disabled defaultPressed>
                            {t('Hide tasks')}
                        </Toggle>
                    </Captioned>
                </div>
                <p className="text-xs text-muted-foreground">
                    {t('Hover and focus: use the pointer and the Tab key.')}
                </p>
                <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                    <Captioned caption={t('Outline, off')}>
                        <Toggle icon={Eye} variant="outline">
                            {t('Watch only')}
                        </Toggle>
                    </Captioned>
                    <Captioned caption={t('Outline, on')}>
                        <Toggle icon={Eye} variant="outline" defaultPressed>
                            {t('Watch only')}
                        </Toggle>
                    </Captioned>
                    <Captioned caption={t('Outline, disabled')}>
                        <Toggle icon={Eye} variant="outline" disabled>
                            {t('Watch only')}
                        </Toggle>
                    </Captioned>
                    <Captioned caption={t('Icon only, off')}>
                        <Toggle icon={UserRound} aria-label={t('Show names')} />
                    </Captioned>
                    <Captioned caption={t('Icon only, on')}>
                        <Toggle
                            icon={UserRound}
                            aria-label={t('Show names')}
                            defaultPressed
                        />
                    </Captioned>
                    <Captioned caption={t('Icon only, disabled')}>
                        <Toggle
                            icon={UserRound}
                            aria-label={t('Show names')}
                            disabled
                        />
                    </Captioned>
                </div>
            </Cell>

            <Cell label={t('ToggleGroup · multiple, toolbar')}>
                <ToggleGroup
                    type="multiple"
                    variant="toolbar"
                    iconOnly
                    aria-label={t('Text formatting')}
                    value={formatting}
                    onValueChange={setFormatting}
                    options={[
                        { value: 'bold', label: t('Bold'), icon: Bold },
                        { value: 'italic', label: t('Italic'), icon: Italic },
                        {
                            value: 'strike',
                            label: t('Strikethrough'),
                            icon: Strikethrough,
                        },
                        {
                            value: 'list',
                            label: t('Bulleted list'),
                            icon: List,
                            separatorBefore: true,
                        },
                        { value: 'link', label: t('Link'), icon: Link },
                    ]}
                />
            </Cell>

            <Cell label={t('ToggleGroup · multiple, filters')}>
                <ToggleGroup
                    type="multiple"
                    variant="outline"
                    aria-label={t('Filter action items')}
                    value={filters}
                    onValueChange={setFilters}
                    options={[
                        { value: 'mine', label: t('Mine'), icon: UserRound },
                        {
                            value: 'overdue',
                            label: t('Overdue'),
                            icon: CalendarClock,
                        },
                        {
                            value: 'ticket',
                            label: t('With ticket'),
                            icon: Ticket,
                        },
                    ]}
                />
            </Cell>

            <Cell label={t('ToggleGroup · single, icon only')}>
                <ToggleGroup
                    type="single"
                    iconOnly
                    aria-label={t('Board view')}
                    value={view}
                    onValueChange={setView}
                    options={[
                        { value: 'grid', label: t('Grid'), icon: LayoutGrid },
                        {
                            value: 'columns',
                            label: t('Columns'),
                            icon: Columns3,
                        },
                        { value: 'list', label: t('List'), icon: List },
                    ]}
                />
            </Cell>

            <Cell label={t('ToggleGroup · segmented')}>
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    aria-label={t('Period')}
                    value={period}
                    onValueChange={setPeriod}
                    options={[
                        { value: '30d', label: t('Last 30 days') },
                        { value: 'all', label: t('All time') },
                    ]}
                />
            </Cell>

            <Cell label={t('ToggleGroup · segmented, full width')}>
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    fullWidth
                    aria-label={t('Theme')}
                    value={theme}
                    onValueChange={setTheme}
                    options={[
                        { value: 'light', label: t('Light'), icon: Sun },
                        { value: 'dark', label: t('Dark'), icon: Moon },
                        { value: 'system', label: t('System'), icon: Monitor },
                    ]}
                />
            </Cell>

            <Cell label={t('Disabled group, with reason')}>
                <ToggleGroup
                    type="single"
                    variant="segmented"
                    aria-label={t('Card authors')}
                    disabledReason={t('Locked during the Voting phase.')}
                    value={authors}
                    onValueChange={setAuthors}
                    options={[
                        { value: 'visible', label: t('Visible'), icon: Eye },
                        { value: 'hidden', label: t('Hidden'), icon: EyeOff },
                    ]}
                />
            </Cell>

            <Cell label={t('Disabled group, toolbar')}>
                <ToggleGroup
                    type="multiple"
                    variant="toolbar"
                    iconOnly
                    disabled
                    aria-label={t('Text formatting')}
                    value={lockedFormatting}
                    onValueChange={() => {}}
                    options={[
                        { value: 'bold', label: t('Bold'), icon: Bold },
                        { value: 'italic', label: t('Italic'), icon: Italic },
                        {
                            value: 'list',
                            label: t('Bulleted list'),
                            icon: List,
                        },
                    ]}
                />
            </Cell>
        </div>
    );
}
