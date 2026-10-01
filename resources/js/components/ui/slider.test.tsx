import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
});

function Controlled({ initial = [8] }: { initial?: number[] }) {
    const [value, setValue] = useState(initial);

    return (
        <Slider
            label="Duration"
            value={value}
            onValueChange={setValue}
            min={0}
            max={20}
            step={1}
            format={(v) => `${v} minutes`}
            showBounds
        />
    );
}

describe('Slider', () => {
    it('exposes slider semantics with a formatted value text', () => {
        render(<Controlled />);
        const thumb = screen.getByRole('slider', { name: 'Duration' });

        expect(thumb.getAttribute('aria-valuemin')).toBe('0');
        expect(thumb.getAttribute('aria-valuemax')).toBe('20');
        expect(thumb.getAttribute('aria-valuenow')).toBe('8');
        expect(thumb.getAttribute('aria-valuetext')).toBe('8 minutes');
        expect(screen.getAllByText('8 minutes').length).toBeGreaterThan(0);
        expect(screen.getByText('0 minutes')).toBeTruthy();
        expect(screen.getByText('20 minutes')).toBeTruthy();
    });

    it('moves by one step with arrow keys and Home/End', () => {
        render(<Controlled />);
        const thumb = screen.getByRole('slider');

        fireEvent.keyDown(thumb, { key: 'ArrowRight' });
        expect(thumb.getAttribute('aria-valuenow')).toBe('9');
        fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
        fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
        expect(thumb.getAttribute('aria-valuenow')).toBe('7');
        fireEvent.keyDown(thumb, { key: 'Home' });
        expect(thumb.getAttribute('aria-valuenow')).toBe('0');
        fireEvent.keyDown(thumb, { key: 'End' });
        expect(thumb.getAttribute('aria-valuenow')).toBe('20');
    });

    it('jumps by 10 percent of the range with Page keys', () => {
        render(<Controlled />);
        const thumb = screen.getByRole('slider');

        fireEvent.keyDown(thumb, { key: 'PageUp' });
        expect(thumb.getAttribute('aria-valuenow')).toBe('10');
        fireEvent.keyDown(thumb, { key: 'PageDown' });
        fireEvent.keyDown(thumb, { key: 'PageDown' });
        expect(thumb.getAttribute('aria-valuenow')).toBe('6');
    });

    it('shows the value bubble only while focused', () => {
        const { container } = render(<Controlled />);
        const thumb = screen.getByRole('slider');

        expect(container.querySelector('[data-slot="slider-bubble"]')).toBeNull();
        fireEvent.focus(thumb);
        expect(
            container.querySelector('[data-slot="slider-bubble"]')?.textContent,
        ).toBe('8 minutes');
        fireEvent.blur(thumb);
        expect(container.querySelector('[data-slot="slider-bubble"]')).toBeNull();
    });

    it('renders two handles for a range', () => {
        render(<Controlled initial={[4, 12]} />);

        expect(screen.getAllByRole('slider')).toHaveLength(2);
        expect(screen.getByText('4 minutes – 12 minutes')).toBeTruthy();
    });

    it('ignores keys when disabled', () => {
        const onValueChange = vi.fn();
        render(
            <Slider
                label="Votes"
                value={[3]}
                onValueChange={onValueChange}
                min={0}
                max={10}
                disabled
            />,
        );
        const thumb = screen.getByRole('slider');

        fireEvent.keyDown(thumb, { key: 'ArrowRight' });
        fireEvent.keyDown(thumb, { key: 'PageUp' });
        expect(onValueChange).not.toHaveBeenCalled();
    });
});

describe('Progress', () => {
    it('writes the value as text and sets aria-valuenow', () => {
        render(<Progress label="Voted" value={7} max={9} valueLabel="7 / 9" />);
        const bar = screen.getByRole('progressbar', { name: 'Voted' });

        expect(bar.getAttribute('aria-valuenow')).toBe('7');
        expect(bar.getAttribute('aria-valuemax')).toBe('9');
        expect(screen.getByText('7 / 9')).toBeTruthy();
        expect(bar.getAttribute('data-tone')).toBe('primary');
    });

    it('falls back to a percentage and turns success at 100 percent', () => {
        render(<Progress label="Done" value={4} max={4} />);
        const bar = screen.getByRole('progressbar');

        expect(screen.getByText('100%')).toBeTruthy();
        expect(bar.getAttribute('data-tone')).toBe('success');
    });

    it('is indeterminate and busy without a value', () => {
        render(<Progress label="Exporting" />);
        const bar = screen.getByRole('progressbar');

        expect(bar.hasAttribute('aria-valuenow')).toBe(false);
        expect(bar.getAttribute('aria-busy')).toBe('true');
    });

    it('links the description to the bar', () => {
        render(<Progress label="Import" value={0} description="Waiting" />);

        const bar = screen.getByRole('progressbar');
        const describedBy = bar.getAttribute('aria-describedby') ?? '';

        expect(document.getElementById(describedBy)?.textContent).toBe('Waiting');
        expect(screen.getByText('0%')).toBeTruthy();
    });
});
