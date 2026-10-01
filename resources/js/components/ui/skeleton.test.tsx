import { render } from '@testing-library/react';
import { createRef } from 'react';
import { expect, it } from 'vitest';
import { Skeleton } from './skeleton';

it('keeps its data-slot and forwards props', () => {
    const { container } = render(<Skeleton className="h-4" data-test="x" />);
    const block = container.querySelector('[data-slot="skeleton"]');

    expect(block?.getAttribute('data-test')).toBe('x');
    expect(block?.classList.contains('h-4')).toBe(true);
});

it('does not break when given a ref prop', () => {
    const ref = createRef<HTMLDivElement>();

    render(<Skeleton ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
});
