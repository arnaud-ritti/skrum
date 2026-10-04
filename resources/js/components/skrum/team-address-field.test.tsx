import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TeamAddressField } from '@/components/skrum/team-address-field';

function Harness({
    initialSlug = null,
    error,
}: {
    initialSlug?: string | null;
    error?: string;
}) {
    const [name, setName] = useState('Atlas');
    const [slug, setSlug] = useState<string | null>(initialSlug);

    return (
        <>
            <label>
                Team name
                <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
            </label>
            <TeamAddressField
                id="team-slug"
                base="skrum.test/t/"
                slug={slug ?? ''}
                name={name}
                isEdited={slug !== null}
                onChange={setSlug}
                error={error}
            />
            <output data-testid="sent">{slug ?? 'not sent'}</output>
        </>
    );
}

function shownSlug(): string | null {
    return (
        document.querySelector('[data-slot="team-address-slug"]')
            ?.textContent ?? null
    );
}

describe('TeamAddressField', () => {
    it('shows the instance address, then the slug derived from the name', () => {
        render(<Harness />);

        expect(screen.getByText('Team link')).toBeTruthy();
        expect(screen.getByText('skrum.test/t/')).toBeTruthy();
        expect(shownSlug()).toBe('atlas');

        fireEvent.change(screen.getByLabelText('Team name'), {
            target: { value: 'Équipe Nord' },
        });

        expect(shownSlug()).toBe('equipe-nord');
        expect(screen.getByTestId('sent').textContent).toBe('not sent');
    });

    it('keeps the typed slug once edited, whatever the name becomes', () => {
        render(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

        const input = screen.getByRole('textbox', { name: 'Team link' });

        expect((input as HTMLInputElement).value).toBe('atlas');

        fireEvent.change(input, { target: { value: 'atlas-team' } });
        fireEvent.change(screen.getByLabelText('Team name'), {
            target: { value: 'Orion' },
        });

        expect((input as HTMLInputElement).value).toBe('atlas-team');
        expect(screen.getByTestId('sent').textContent).toBe('atlas-team');
    });

    it('marks a slug of the wrong form', () => {
        render(<Harness />);

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

        const input = screen.getByRole('textbox', { name: 'Team link' });

        fireEvent.change(input, { target: { value: 'Atlas Team' } });

        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(
            screen.getByText('Use lower-case letters, digits and hyphens.'),
        ).toBeTruthy();
    });

    it('shows an existing slug as it is, not the one of the name', () => {
        render(<Harness initialSlug="atlas-2" />);

        expect(shownSlug()).toBe('atlas-2');
    });

    it('shows the server error under the field', () => {
        render(
            <Harness
                initialSlug="atlas"
                error="This link is already taken in Nordlys."
            />,
        );

        expect(
            screen.getByText('This link is already taken in Nordlys.'),
        ).toBeTruthy();
    });
});
