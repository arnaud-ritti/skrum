import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar, SidebarProvider } from '@/components/ui/sidebar';

function renderSidebar() {
    return render(
        <SidebarProvider>
            <Sidebar>
                <textarea aria-label="Card" />
                <div contentEditable suppressContentEditableWarning>
                    Note
                </div>
            </Sidebar>
        </SidebarProvider>,
    );
}

function sidebarState(container: HTMLElement): string | null | undefined {
    return container
        .querySelector('[data-slot="sidebar"]')
        ?.getAttribute('data-state');
}

describe('SidebarProvider', () => {
    it('toggles the sidebar on Ctrl+B outside a field', () => {
        const { container } = renderSidebar();

        fireEvent.keyDown(document.body, { key: 'b', ctrlKey: true });

        expect(sidebarState(container)).toBe('collapsed');
    });

    it('leaves Ctrl+B to a field being typed in', () => {
        const { container, getByLabelText } = renderSidebar();

        fireEvent.keyDown(getByLabelText('Card'), { key: 'b', ctrlKey: true });

        expect(sidebarState(container)).toBe('expanded');
    });

    it('leaves Ctrl+B alone once a handler has taken it', () => {
        const { container } = renderSidebar();
        const event = new KeyboardEvent('keydown', {
            key: 'b',
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
        });

        event.preventDefault();
        act(() => {
            document.body.dispatchEvent(event);
        });

        expect(sidebarState(container)).toBe('expanded');
    });
});
