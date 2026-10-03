import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SurveyPreviewDialog } from '@/components/surveys/survey-preview-dialog';
import { renderWithProviders } from '@/test/render';

describe('SurveyPreviewDialog', () => {
    it('shows the participant view it is given under the survey title', () => {
        renderWithProviders(
            <SurveyPreviewDialog
                open
                onOpenChange={vi.fn()}
                title="Team pulse — sprint 42"
            >
                <p>Participant view</p>
            </SurveyPreviewDialog>,
        );

        const dialog = screen.getByRole('dialog', { name: 'Preview' });

        expect(dialog.textContent).toContain('Team pulse — sprint 42');
        expect(dialog.textContent).toContain('Participant view');
    });

    it('renders nothing while closed', () => {
        renderWithProviders(
            <SurveyPreviewDialog open={false} onOpenChange={vi.fn()} title="T">
                <p>Participant view</p>
            </SurveyPreviewDialog>,
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
