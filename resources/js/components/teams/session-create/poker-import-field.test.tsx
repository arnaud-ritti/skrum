import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PokerImportField } from '@/components/teams/session-create/poker-import-field';
import type { PokerImportValue } from '@/components/teams/session-create/poker-import-field';
import type { PokerTrackerSource } from '@/lib/poker/types';
import { RetroRequestError } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

async function waitForAutomaticPreview(): Promise<void> {
    if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(600);
    } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
    }
}

function Harness({
    sources,
    error,
}: {
    sources: PokerTrackerSource[];
    error?: string;
}) {
    const [value, setValue] = useState<PokerImportValue>({
        source: sources[0],
        ids: [],
    });

    return (
        <>
            <PokerImportField
                workspaceSlug="acme"
                teamId="t1"
                sources={sources}
                value={value}
                onChange={setValue}
                error={error}
            />
            <output data-testid="value">
                {`${value.source}:${value.ids.join('|')}`}
            </output>
        </>
    );
}

function value(): string {
    return screen.getByTestId('value').textContent ?? '';
}

function urls(): string[] {
    return mocks.request.mock.calls.map((call) => call[0].url as string);
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.request.mockReset();
    mocks.request.mockResolvedValue({ containers: [] });
});

describe('PokerImportField', () => {
    it('has no source select with one tracker', () => {
        renderWithProviders(<Harness sources={['jira']} />);

        expect(screen.queryByRole('combobox', { name: 'Source' })).toBeNull();
    });

    it('browses the team routes and keeps the chosen tickets', async () => {
        mocks.request.mockResolvedValueOnce({
            issues: [
                {
                    externalId: '10002',
                    key: 'PROJ-2',
                    title: 'Export actions to CSV',
                    assignee: null,
                    estimate: null,
                    status: null,
                    alreadyImported: false,
                },
            ],
            truncated: false,
        });
        renderWithProviders(<Harness sources={['jira']} />);

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }), {
            button: 0,
        });
        fireEvent.change(
            screen.getByLabelText('Query', { selector: 'textarea' }),
            { target: { value: 'project = PROJ' } },
        );

        await act(async () => {
            await waitForAutomaticPreview();
        });

        expect(urls()).toEqual(['/w/acme/teams/t1/poker-imports/jira/preview']);
        expect(value()).toBe('jira:10002');
    });

    it('offers the sources with two trackers, and starts over on another one', async () => {
        renderWithProviders(<Harness sources={['jira', 'linear']} />);

        const user = userEvent.setup();

        await user.click(screen.getByRole('combobox', { name: 'Source' }));

        expect(
            screen.getAllByRole('option').map((option) => option.textContent),
        ).toEqual(['Jira', 'Linear']);
        expect(
            screen
                .getByRole('option', { name: 'Linear' })
                .querySelector('[data-provider-mark="linear"]'),
        ).not.toBeNull();

        await user.click(screen.getByRole('option', { name: 'Linear' }));

        expect(value()).toBe('linear:');
        expect(screen.getByLabelText('Team')).toBeTruthy();
    });

    it('shows the message of the tracker, and the error of the server tied to the picker', async () => {
        mocks.request.mockRejectedValueOnce(
            new RetroRequestError(422, 'Reconnect Jira in the team settings.'),
        );
        renderWithProviders(
            <Harness
                sources={['jira']}
                error="Jira did not answer. Try again later."
            />,
        );

        fireEvent.mouseDown(screen.getByRole('tab', { name: 'Query' }), {
            button: 0,
        });
        fireEvent.change(
            screen.getByLabelText('Query', { selector: 'textarea' }),
            { target: { value: 'project = PROJ' } },
        );

        await act(async () => {
            await waitForAutomaticPreview();
        });

        expect(
            screen.getAllByRole('alert').map((alert) => alert.textContent),
        ).toEqual([
            'Reconnect Jira in the team settings.',
            'Jira did not answer. Try again later.',
        ]);

        const picker = screen.getByRole('group', { name: 'Import from Jira' });

        expect(picker.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(picker.getAttribute('aria-describedby')!)
                ?.textContent,
        ).toBe('Jira did not answer. Try again later.');
    });
});
