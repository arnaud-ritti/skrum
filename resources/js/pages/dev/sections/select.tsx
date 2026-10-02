import { Cloud, Flag, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { Combobox, SelectField } from '@/components/skrum/combobox';
import type { SelectOption } from '@/components/skrum/combobox';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function Example({
    label,
    className,
    children,
}: {
    label: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`flex min-w-0 flex-col gap-2 ${className ?? ''}`}>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function SelectSection() {
    const { t } = useTrans();
    const [value, setValue] = useState<string | undefined>(
        'start-stop-continue',
    );
    const [member, setMember] = useState<string | undefined>();
    const [created, setCreated] = useState<SelectOption[]>([]);
    const [selectOpen, setSelectOpen] = useState(true);
    const [comboboxOpen, setComboboxOpen] = useState(true);

    /*
     * Radix closes a Select when the window is resized: the bench opens both
     * lists again so that every viewport shows them.
     */
    useEffect(() => {
        const reopen = (): void => {
            window.setTimeout(() => {
                setSelectOpen(true);
                setComboboxOpen(true);
            }, 0);
        };

        window.addEventListener('resize', reopen);

        return () => window.removeEventListener('resize', reopen);
    }, []);

    const templates: SelectOption[] = [
        {
            value: 'start-stop-continue',
            label: t('Start, Stop, Continue'),
            group: t('Classic'),
        },
        {
            value: 'mad-sad-glad',
            label: t('Mad, Sad, Glad'),
            group: t('Classic'),
        },
        {
            value: 'four-ls',
            label: t('The 4 Ls: Liked, Learned, Lacked, Longed for'),
            group: t('Classic'),
        },
        {
            value: 'sailboat',
            label: t('Sailboat'),
            group: t('Visual'),
            icon: <Cloud className="size-4" />,
        },
        {
            value: 'rocket',
            label: t('Rocket'),
            group: t('Visual'),
            icon: <Zap className="size-4" />,
        },
        {
            value: 'archived',
            label: t('Archived template'),
            group: t('Visual'),
            disabled: true,
        },
        {
            value: 'long',
            label: t(
                'Rétrospective de fin de trimestre avec toute l’équipe produit, design et ingénierie',
            ),
            group: t('Visual'),
        },
    ];
    const longLabels: SelectOption[] = [
        {
            value: 'long',
            label: t(
                'Rétrospective de fin de trimestre avec toute l’équipe produit, design et ingénierie',
            ),
        },
        { value: 'short', label: t('Quotidienne') },
    ];
    const members: SelectOption[] = [
        ...Array.from({ length: 24 }, (_, index) => ({
            value: `m${index}`,
            label: t('Camille Lefèvre-Delacroix :n', { n: index + 1 }),
            icon: <Flag className="size-4" />,
        })),
        ...created,
    ];

    /* Both lists sit below the fold, so they open upwards: this keeps the room they need free. */
    const listRoom = <div aria-hidden="true" className="h-96" />;

    return (
        <div className="grid gap-8 p-4 md:p-6 lg:grid-cols-2">
            <Example label={t('Select closed with a value')}>
                <SelectField
                    label={t('Retro template')}
                    options={templates}
                    value={value}
                    onValueChange={setValue}
                />
            </Example>
            <Example label={t('Select closed, placeholder')}>
                <SelectField
                    label={t('Retro template')}
                    options={templates}
                    placeholder={t('Choose a template')}
                    onValueChange={noop}
                />
            </Example>
            <Example label={t('Select invalid with message')}>
                <SelectField
                    label={t('Retro template')}
                    options={templates}
                    error={t('Choose a template to continue.')}
                    onValueChange={noop}
                />
            </Example>
            <Example label={t('Select disabled')}>
                <SelectField
                    label={t('Retro template')}
                    options={templates}
                    value="mad-sad-glad"
                    disabled
                    onValueChange={noop}
                />
            </Example>
            <Example
                label={t('Select, long label truncated in a narrow field')}
            >
                <SelectField
                    label={t('Retro template')}
                    options={longLabels}
                    value="long"
                    className="max-w-56"
                    onValueChange={noop}
                />
            </Example>
            <Example label={t('Select with no options')}>
                <SelectField
                    label={t('Retro template')}
                    options={[]}
                    placeholder={t('Choose a template')}
                    onValueChange={noop}
                />
            </Example>
            <Example label={t('Combobox closed')}>
                <Combobox
                    label={t('Assignee')}
                    options={members}
                    value={member}
                    placeholder={t('Choose a member')}
                    onValueChange={setMember}
                    onCreate={(query) => {
                        setCreated((current) => [
                            ...current,
                            { value: `new-${query}`, label: query },
                        ]);
                        setMember(`new-${query}`);
                    }}
                />
            </Example>
            <Example label={t('Combobox invalid')}>
                <Combobox
                    label={t('Assignee')}
                    options={members}
                    error={t('Assign someone to continue.')}
                    onValueChange={noop}
                />
            </Example>
            <Example label={t('Combobox disabled')}>
                <Combobox
                    label={t('Assignee')}
                    options={members}
                    value="m1"
                    disabled
                    onValueChange={noop}
                />
            </Example>
            <Example
                label={t(
                    'Select open (groups, icons, disabled item, selected check, long French label)',
                )}
            >
                {listRoom}
                <SelectField
                    label={t('Retro template')}
                    options={templates}
                    value="rocket"
                    className="max-w-72"
                    open={selectOpen}
                    onOpenChange={setSelectOpen}
                    onValueChange={noop}
                />
            </Example>
            <Example label={t('Combobox open (search, long list scrolls)')}>
                {listRoom}
                <Combobox
                    label={t('Assignee')}
                    options={members}
                    value="m2"
                    className="max-w-72"
                    open={comboboxOpen}
                    onOpenChange={(next) => setComboboxOpen(next || selectOpen)}
                    onValueChange={noop}
                />
            </Example>
        </div>
    );
}
