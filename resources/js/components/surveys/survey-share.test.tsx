import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SurveyShare } from '@/components/surveys/survey-share';
import type { SurveySnapshot } from '@/lib/surveys/types';
import { renderWithProviders } from '@/test/render';
import { surveySnapshot } from '@/test/survey-snapshot';

const api = vi.hoisted(() => ({
    update: vi.fn(),
    newGuestLink: vi.fn(),
}));

vi.mock('@/lib/surveys/api', () => ({ surveyApi: api }));

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));

const dispatch = vi.fn();

const sharedSnapshot = (
    me: Partial<SurveySnapshot['me']> = { isEditor: true },
): SurveySnapshot =>
    surveySnapshot({
        survey: {
            guestAccessEnabled: true,
            guestUrl: 'https://skrum.test/surveys/join/token-1',
        },
        me,
    });

beforeEach(() => {
    dispatch.mockReset();
    Object.values(api).forEach((mock) => mock.mockReset());
});

function openShare(snapshot: SurveySnapshot = sharedSnapshot()) {
    renderWithProviders(
        <SurveyShare snapshot={snapshot} dispatch={dispatch} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
}

describe('SurveyShare', () => {
    it('gives an editor the guest link, its switch and a new link', () => {
        openShare();

        expect(
            (screen.getByLabelText('Guest link') as HTMLInputElement).value,
        ).toBe('https://skrum.test/surveys/join/token-1');
        expect(
            screen.getByRole('switch', { name: 'Allow guests' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Create a new link' }),
        ).toBeTruthy();
    });

    it('turns guest access off through the survey settings and keeps the snapshot it answers', async () => {
        const updated = sharedSnapshot();

        updated.survey.guestAccessEnabled = false;
        api.update.mockResolvedValue(updated);
        openShare();

        fireEvent.click(screen.getByRole('switch', { name: 'Allow guests' }));

        await waitFor(() =>
            expect(dispatch).toHaveBeenCalledWith({
                type: 'snapshot.replace',
                snapshot: updated,
            }),
        );
        expect(api.update).toHaveBeenCalledWith('s1', {
            guest_access_enabled: false,
        });
    });

    it('creates a new link only after a confirmation, and shows it', async () => {
        api.newGuestLink.mockResolvedValue({
            guestUrl: 'https://skrum.test/surveys/join/token-2',
        });
        openShare();

        fireEvent.click(
            screen.getByRole('button', { name: 'Create a new link' }),
        );

        expect(api.newGuestLink).not.toHaveBeenCalled();

        fireEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Create a new link',
            }),
        );

        await waitFor(() => expect(dispatch).toHaveBeenCalled());
        expect(api.newGuestLink).toHaveBeenCalledWith('s1');
        expect(dispatch.mock.calls[0][0]).toMatchObject({
            type: 'snapshot.replace',
            snapshot: {
                survey: {
                    guestUrl: 'https://skrum.test/surveys/join/token-2',
                },
            },
        });
    });

    it('shows a member who does not edit the survey the link and no control', () => {
        openShare(sharedSnapshot({ isEditor: false }));

        expect(
            (screen.getByLabelText('Guest link') as HTMLInputElement).value,
        ).toBe('https://skrum.test/surveys/join/token-1');
        expect(screen.queryByRole('switch', { name: 'Allow guests' })).toBe(
            null,
        );
        expect(
            screen.queryByRole('button', { name: 'Create a new link' }),
        ).toBeNull();
    });

    it('offers a guest no Share button', () => {
        renderWithProviders(
            <SurveyShare
                snapshot={sharedSnapshot({ isGuest: true })}
                dispatch={dispatch}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    });
});
