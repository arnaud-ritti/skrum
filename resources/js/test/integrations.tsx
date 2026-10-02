import { fireEvent, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithProviders } from './render';

/** Opens the sheet of every provider row on the page, as "Configure" does. */
export function openProviderPanels(): void {
    document
        .querySelectorAll('[data-slot="provider-row-configure"]')
        .forEach((button) => fireEvent.click(button));
}

/** Renders a provider and opens its sheet: details, panels and actions live there. */
export function renderProvider(ui: ReactElement): RenderResult {
    const result = renderWithProviders(ui);

    openProviderPanels();

    return result;
}

/** The open sheet of a provider. */
export function providerPanel(name: string): HTMLElement {
    return screen.getByRole('dialog', { name });
}

/** The status of a provider as its row says it, without what it points to. */
export function providerStatus(name: string): string | undefined {
    const row = Array.from(
        document.querySelectorAll('[data-slot="provider-row"]'),
    ).find((candidate) => candidate.querySelector('h3')?.textContent === name);

    return row
        ?.querySelector('[data-slot="provider-row-status"]')
        ?.textContent?.split(' · ')[0];
}

/** The buttons of a provider's sheet, the one that closes it left out. */
export function providerButtons(panel: HTMLElement): HTMLElement[] {
    return Array.from(panel.querySelectorAll<HTMLElement>('button')).filter(
        (button) => button.dataset.slot !== 'sheet-close-button',
    );
}

/** A dialog opened above the sheet of a provider: a form or a confirmation. */
export function dialogOverPanel(): HTMLElement | null {
    return document.querySelector<HTMLElement>(
        '[role="dialog"]:not([data-slot="sheet-content"])',
    );
}
