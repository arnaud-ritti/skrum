import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroTemplatesCard } from '@/components/team-settings/retro-templates-card';
import { renderWithProviders } from '@/test/render';
import type { CatalogueTemplate, TeamTemplateUsageRow } from '@/types';

const mocks = vi.hoisted(() => ({
    put: vi.fn(),
    post: vi.fn(),
    reload: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router: { put: mocks.put, post: mocks.post, reload: mocks.reload },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function usage(
    key: string,
    name: string,
    usageCount: number,
    isDefault = false,
): TeamTemplateUsageRow {
    return {
        key,
        name,
        category: 'essentials',
        columns: [
            { title: 'Good', description: null, color: 'moss' },
            { title: 'Bad', description: null, color: 'coral' },
        ],
        usageCount,
        isDefault,
        templateId: null,
        canEdit: false,
    };
}

const templates = [
    usage('start_stop_continue', 'Start · Stop · Continue', 6, true),
    usage('four_ls', '4L', 0),
];

const catalogue: CatalogueTemplate[] = [
    {
        key: 'sailboat',
        name: 'Sailboat',
        category: 'themed',
        isCommon: false,
        isWorkspace: false,
        columns: [{ title: 'Wind', description: null, color: 'sky' }],
    },
];

function card(
    props: Partial<{
        defaultTemplate: string | null;
        defaultUnavailable: boolean;
        catalogue: CatalogueTemplate[];
    }> = {},
) {
    return renderWithProviders(
        <RetroTemplatesCard
            workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
            team={{ id: 't1', name: 'Atlas' }}
            templates={templates}
            defaultTemplate={
                props.defaultTemplate === undefined
                    ? 'start_stop_continue'
                    : props.defaultTemplate
            }
            defaultUnavailable={props.defaultUnavailable ?? false}
            categories={[{ value: 'essentials', label: 'Essentials' }]}
            catalogue={props.catalogue}
        />,
    );
}

function section(): HTMLElement {
    return document.querySelector<HTMLElement>('section#retro-templates')!;
}

beforeAll(() => {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
    mocks.put.mockReset();
    mocks.post.mockReset();
    mocks.reload.mockReset();
});

describe('RetroTemplatesCard', () => {
    it('lists the templates as radios with the default, the colours and the usage', () => {
        card();

        const standard = screen.getByRole('radio', {
            name: 'Start · Stop · Continue',
        });

        expect(standard.getAttribute('aria-checked')).toBe('true');
        expect(
            screen
                .getByRole('radio', { name: '4L' })
                .getAttribute('aria-checked'),
        ).toBe('false');
        expect(section().textContent).toContain('Default');
        expect(section().textContent).toContain('Used 6×');
        expect(section().textContent).toContain('Never used');
        expect(
            section().querySelectorAll('[data-slot="template-color-strip"]')[0]
                .children,
        ).toHaveLength(2);
    });

    it('saves the template chosen as the default', async () => {
        card();

        await userEvent.click(screen.getByRole('radio', { name: '4L' }));

        expect(mocks.put.mock.calls[0][0]).toBe(
            '/w/nordlys/teams/t1/default-retro-template',
        );
        expect(mocks.put.mock.calls[0][1]).toEqual({ template: 'four_ls' });
    });

    it('lets the keyboard browse the templates and saves only on Space', async () => {
        card();

        screen.getByRole('radio', { name: 'Start · Stop · Continue' }).focus();
        await userEvent.keyboard('{ArrowDown>}');
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        await userEvent.keyboard('{/ArrowDown}');

        expect(mocks.put).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: '4L' }),
        );

        await userEvent.keyboard(' ');

        expect(mocks.put).toHaveBeenCalledTimes(1);
        expect(mocks.put.mock.calls[0][1]).toEqual({ template: 'four_ls' });
    });

    it('asks for another template when the default is gone', () => {
        card({ defaultTemplate: null, defaultUnavailable: true });

        expect(section().textContent).toContain(
            'This template is no longer available. Choose another.',
        );
    });

    it('opens the template editor for a new team template', async () => {
        card();

        await userEvent.click(
            within(section()).getByRole('button', { name: 'Create' }),
        );

        expect(
            screen.getByRole('dialog', { name: 'New template' }),
        ).toBeTruthy();
    });

    it('loads the catalogue to browse and makes the template used the default', async () => {
        const view = card();

        await userEvent.click(
            within(section()).getByRole('button', { name: 'Browse' }),
        );

        expect(mocks.reload).toHaveBeenCalledWith(
            expect.objectContaining({ only: ['catalogue'] }),
        );

        view.rerender(
            <RetroTemplatesCard
                workspace={{ id: 'w1', name: 'Nordlys', slug: 'nordlys' }}
                team={{ id: 't1', name: 'Atlas' }}
                templates={templates}
                defaultTemplate="start_stop_continue"
                defaultUnavailable={false}
                categories={[{ value: 'essentials', label: 'Essentials' }]}
                catalogue={catalogue}
            />,
        );

        const browser = screen.getByRole('dialog', { name: 'Retro templates' });

        await userEvent.click(within(browser).getByText('Sailboat'));
        await userEvent.click(
            within(browser).getByRole('button', { name: 'Use this template' }),
        );

        expect(mocks.put.mock.calls[0][1]).toEqual({ template: 'sailboat' });
    });
});
