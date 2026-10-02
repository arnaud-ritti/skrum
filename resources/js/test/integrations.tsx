import { fireEvent, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { renderWithProviders } from './render';

function providerRow(name: string): Element | undefined {
    return Array.from(
        document.querySelectorAll('[data-slot="provider-row"]'),
    ).find((candidate) => candidate.querySelector('h3')?.textContent === name);
}

/**
 * Opens the sheet of one provider, as the button of its row does. A sheet is
 * modal: only one can be open, so a page with several rows must name the one.
 */
export function openProviderPanel(name?: string): void {
    const buttons =
        name === undefined
            ? Array.from(
                  document.querySelectorAll(
                      '[data-slot="provider-row-configure"]',
                  ),
              )
            : Array.from(
                  providerRow(name)?.querySelectorAll(
                      '[data-slot="provider-row-configure"]',
                  ) ?? [],
              );

    if (buttons.length !== 1) {
        throw new Error(
            `Expected one provider row to open, found ${buttons.length}.`,
        );
    }

    fireEvent.click(buttons[0]);
}

/** Renders a provider and opens its sheet: details, panels and actions live there. */
export function renderProvider(ui: ReactElement, name?: string): RenderResult {
    const result = renderWithProviders(ui);

    openProviderPanel(name);

    return result;
}

/** The open sheet of a provider. */
export function providerPanel(name: string): HTMLElement {
    return screen.getByRole('dialog', { name });
}

/** The status of a provider as its row says it, without what it points to. */
export function providerStatus(name: string): string | undefined {
    const row = providerRow(name);

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
