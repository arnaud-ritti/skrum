import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { RetroFacilitatorField } from '@/components/teams/session-create/retro-facilitator-field';
import { renderWithProviders } from '@/test/render';
import type { FacilitatorOption } from '@/types';

const options: FacilitatorOption[] = [
    { id: 'camille', name: 'Camille Roux', avatarUrl: '' },
    { id: 'ines', name: 'Inès Bernard', avatarUrl: '' },
    { id: 'me', name: 'Mia Lopez', avatarUrl: '' },
];

function renderField(
    props: Partial<Parameters<typeof RetroFacilitatorField>[0]> = {},
) {
    const onChange = vi.fn();

    renderWithProviders(
        <RetroFacilitatorField
            options={options}
            viewerId="me"
            suggestedId="camille"
            rotation
            value="camille"
            onChange={onChange}
            {...props}
        />,
    );

    return { onChange };
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

const trigger = () => screen.getByRole('combobox', { name: 'Facilitator' });

describe('RetroFacilitatorField', () => {
    it('lists the viewer first as "Me", then the others, the suggested person marked', async () => {
        const user = userEvent.setup();

        renderField();

        expect(trigger().id).toBe('new-retro-facilitator');
        expect(trigger().querySelector('.truncate')?.textContent).toBe(
            'Camille Roux (suggested)',
        );

        await user.click(trigger());

        expect(
            screen
                .getAllByRole('option')
                .map(
                    (option) => option.querySelector('.truncate')?.textContent,
                ),
        ).toEqual(['Me', 'Camille Roux (suggested)', 'Inès Bernard']);
    });

    it("shows each person's avatar in the list and on the chosen value", async () => {
        const user = userEvent.setup();

        renderField();

        expect(
            trigger().querySelector('[data-slot="person-avatar"]'),
        ).not.toBeNull();

        await user.click(trigger());

        expect(
            screen
                .getAllByRole('option')
                .every(
                    (option) =>
                        option.querySelector('[data-slot="person-avatar"]') !==
                        null,
                ),
        ).toBe(true);
    });

    it('says the rotation chose the suggestion', () => {
        renderField();

        expect(screen.getByText('Suggested by the rotation.')).toBeTruthy();
    });

    it('has no rotation line when the rotation is off', () => {
        renderField({ rotation: false });

        expect(screen.queryByText('Suggested by the rotation.')).toBeNull();
    });

    it('has no rotation line when the suggested person is no longer listed', () => {
        renderField({ suggestedId: 'gone', value: 'me' });

        expect(screen.queryByText('Suggested by the rotation.')).toBeNull();
        expect(trigger().querySelector('.truncate')?.textContent).toBe('Me');
    });

    it('offers the viewer as "Me" when they are not among the team members listed', async () => {
        const user = userEvent.setup();

        renderField({ viewerId: 'admin', value: 'admin', suggestedId: null });

        await user.click(trigger());

        expect(
            screen
                .getAllByRole('option')
                .map(
                    (option) => option.querySelector('.truncate')?.textContent,
                ),
        ).toEqual(['Me', 'Camille Roux', 'Inès Bernard', 'Mia Lopez']);
    });

    it('hands the chosen person to the form', async () => {
        const user = userEvent.setup();
        const { onChange } = renderField();

        await user.click(trigger());
        await user.click(screen.getByRole('option', { name: 'Inès Bernard' }));

        expect(onChange).toHaveBeenCalledWith('ines');
    });

    it('shows the server refusal under the select', () => {
        renderField({ error: 'Choose a facilitator from the team.' });

        expect(screen.getByRole('alert').textContent).toBe(
            'Choose a facilitator from the team.',
        );
    });
});
