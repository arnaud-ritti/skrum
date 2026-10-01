<?php

namespace App\Actions\Whiteboards;

use App\Models\WhiteboardElement;
use Illuminate\Support\Collection;

/**
 * Puts elements in the order the canvas stacks them: by fractional index,
 * compared byte by byte as Excalidraw does, then by id. A client handed any
 * other order repairs the indices itself and writes the repair back, which
 * moves elements for everyone. A database collation does not sort this way,
 * so the order is made here.
 */
class OrderWhiteboardElements
{
    /**
     * @param  Collection<int, WhiteboardElement>  $elements
     * @return Collection<int, WhiteboardElement>
     */
    public function handle(Collection $elements): Collection
    {
        return $elements
            ->sort(fn (WhiteboardElement $first, WhiteboardElement $second): int => $this->compare($first, $second))
            ->values();
    }

    private function compare(WhiteboardElement $first, WhiteboardElement $second): int
    {
        $firstIndex = $this->index($first);
        $secondIndex = $this->index($second);

        if ($firstIndex === null || $secondIndex === null) {
            return [$firstIndex === null, $first->seq] <=> [$secondIndex === null, $second->seq];
        }

        return strcmp($firstIndex, $secondIndex) ?: strcmp($first->element_id, $second->element_id);
    }

    private function index(WhiteboardElement $element): ?string
    {
        $index = $element->data['index'] ?? null;

        if (! is_string($index) || $index === '') {
            return null;
        }

        return $index;
    }
}
