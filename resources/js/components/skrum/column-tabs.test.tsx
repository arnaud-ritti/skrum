import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnTabs, columnTabId } from '@/components/skrum/column-tabs';
import type { ColumnTab } from '@/components/skrum/column-tabs';
import { renderWithProviders } from '@/test/render';

const tabs: ColumnTab[] = [
    { id: 'well', label: 'Went well', color: 'moss', count: 6 },
    { id: 'improve', label: 'To improve', color: 'coral', count: 1 },
    { id: 'ideas', label: 'Ideas', color: 'sky', count: 0 },
];

function Host({ onChange }: { onChange?: (id: string) => void }) {
    const [value, setValue] = useState('improve');

    return (
        <ColumnTabs
            aria-label="Columns"
            tabs={tabs}
            value={value}
            panelId="panel"
            onValueChange={(id) => {
                onChange?.(id);
                setValue(id);
            }}
        />
    );
}

describe('ColumnTabs', () => {
    it('names one tab per column, with its count, and selects one', () => {
        renderWithProviders(<Host />);

        const list = screen.getByRole('tablist', { name: 'Columns' });

        expect(list.querySelectorAll('[role="tab"]')).toHaveLength(3);
        expect(
            screen.getByRole('tab', { name: /^Went well\s*6 cards$/ }),
        ).toBeTruthy();

        const selected = screen.getByRole('tab', {
            name: /^To improve\s*1 card$/,
        });

        expect(selected.getAttribute('aria-selected')).toBe('true');
        expect(selected.getAttribute('aria-controls')).toBe('panel');
        expect(selected.id).toBe(columnTabId('panel', 'improve'));
        expect(selected.classList.contains('col-coral')).toBe(true);
        expect(selected.tabIndex).toBe(0);
        expect(
            screen.getByRole('tab', { name: /^Ideas\s*0 cards$/ }).tabIndex,
        ).toBe(-1);
    });

    it('selects a tab on a press', () => {
        const onChange = vi.fn();

        renderWithProviders(<Host onChange={onChange} />);
        fireEvent.click(screen.getByRole('tab', { name: /^Ideas\s*0 cards$/ }));

        expect(onChange).toHaveBeenCalledExactlyOnceWith('ideas');
    });

    it('moves the selection and the focus with the arrows, Home and End', () => {
        renderWithProviders(<Host />);

        const press = (key: string) =>
            fireEvent.keyDown(document.activeElement as HTMLElement, { key });
        const selectedName = () =>
            screen
                .getAllByRole('tab')
                .find((tab) => tab.getAttribute('aria-selected') === 'true')
                ?.textContent;

        screen.getByRole('tab', { name: /^To improve\s*1 card$/ }).focus();

        press('ArrowRight');
        expect(selectedName()).toContain('Ideas');
        expect(document.activeElement?.textContent).toContain('Ideas');

        press('ArrowRight');
        expect(selectedName()).toContain('Ideas');

        press('Home');
        expect(selectedName()).toContain('Went well');
        expect(document.activeElement?.textContent).toContain('Went well');

        press('End');
        expect(selectedName()).toContain('Ideas');

        press('ArrowLeft');
        expect(selectedName()).toContain('To improve');
    });

    it('marks the place of the selected tab in the dots, hidden from assistive technology', () => {
        const { container } = renderWithProviders(<Host />);
        const dots = container.querySelector(
            '[data-slot="column-tabs-dots"]',
        ) as HTMLElement;

        expect(dots.getAttribute('aria-hidden')).toBe('true');
        expect(dots.children).toHaveLength(3);
        expect(dots.children[1].hasAttribute('data-current')).toBe(true);
        expect(dots.children[0].hasAttribute('data-current')).toBe(false);
    });

    it('has no dots for a single tab', () => {
        const { container } = renderWithProviders(
            <ColumnTabs
                aria-label="Columns"
                tabs={tabs.slice(0, 1)}
                value="well"
                panelId="panel"
                onValueChange={() => {}}
            />,
        );

        expect(
            container.querySelector('[data-slot="column-tabs-dots"]'),
        ).toBeNull();
    });
});
