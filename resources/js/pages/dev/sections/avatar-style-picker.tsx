import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { AvatarStylePicker } from '@/components/skrum/avatar-style-picker';
import type { AvatarStyleOption } from '@/components/skrum/avatar-style-picker';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

const noop = (): void => {};

function sampleUrls(...digits: string[]): string[] {
    return digits.map((digit) => `/avatars/${digit.repeat(32)}.svg`);
}

const names = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Linus Torvalds'];

const baseOptions: AvatarStyleOption[] = [
    {
        value: 'initials',
        name: 'Initials',
        license: 'CC0 1.0',
        sampleUrls: [],
    },
    {
        value: 'notionists',
        name: 'Notionists',
        license: 'CC0 1.0',
        recommended: true,
        sampleUrls: sampleUrls('a', 'b', 'c', 'd'),
    },
    {
        value: 'thumbs',
        name: 'Thumbs',
        license: 'CC0 1.0',
        sampleUrls: sampleUrls('1', '2', '3', '4'),
    },
    {
        value: 'funEmoji',
        name: 'Fun Emoji',
        license: 'CC BY 4.0',
        attribution: 'Fun Emoji by Davis Uche, licensed CC BY 4.0',
        sampleUrls: sampleUrls('5', '6', '7', '8'),
    },
    {
        value: 'broken',
        name: 'Image fails to load (initials fallback)',
        license:
            'Free for personal and commercial use, with a very long licence label',
        sampleUrls: [
            '/avatars/not-a-valid-seed.svg',
            '/avatars/nope.svg',
            '/avatars/zzz.svg',
        ],
    },
];

const manyOptions: AvatarStyleOption[] = Array.from(
    { length: 31 },
    (_, index) => ({
        value: `style-${index}`,
        name: `Style number ${index + 1}`,
        license: index % 3 === 0 ? 'CC BY 4.0' : 'CC0 1.0',
        attribution:
            index % 3 === 0
                ? `Style ${index + 1} by An Author, CC BY 4.0`
                : undefined,
        sampleUrls: sampleUrls('e', 'f', '9'),
    }),
);

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

function Interactive({
    options,
    locked = false,
    names: sampleNames = names,
}: {
    options: AvatarStyleOption[];
    locked?: boolean;
    names?: string[];
}) {
    const [value, setValue] = useState(options[1]?.value ?? options[0].value);
    const [allow, setAllow] = useState(false);

    return (
        <AvatarStylePicker
            value={value}
            onChange={setValue}
            options={options}
            sampleNames={sampleNames}
            allowMemberChoice={allow}
            onAllowMemberChoiceChange={setAllow}
            locked={locked}
        />
    );
}

export default function AvatarStylePickerSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example
                label={t(
                    'Admin view (arrows and Space change the style, the switch lets members choose)',
                )}
            >
                <Interactive options={baseOptions} />
            </Example>
            <Example label={t('Initials style selected')}>
                <AvatarStylePicker
                    value="initials"
                    onChange={noop}
                    options={baseOptions}
                    sampleNames={names}
                    allowMemberChoice
                    onAllowMemberChoiceChange={noop}
                />
            </Example>
            <Example
                label={t(
                    'Locked: member view, style imposed by the administrator',
                )}
            >
                <Interactive options={baseOptions} locked />
            </Example>
            <Example label={t('A single option')}>
                <Interactive options={baseOptions.slice(1, 2)} />
            </Example>
            <Example label={t('31 styles and a 60-character member name')}>
                <Interactive
                    options={manyOptions}
                    names={[
                        'Maximilian Alexander Bartholomew Montgomery-Wellington Smith',
                        'Grace Hopper',
                        'Alan Turing',
                    ]}
                />
            </Example>
        </div>
    );
}
