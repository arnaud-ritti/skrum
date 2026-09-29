<?php

namespace App\Support\Gifs;

class Gif
{
    public function __construct(
        public string $id,
        public string $previewUrl,
        public string $fullUrl,
        public int $width,
        public int $height,
    ) {}

    /**
     * @param  array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}  $data
     */
    public static function fromArray(array $data): self
    {
        return new self($data['id'], $data['previewUrl'], $data['fullUrl'], $data['width'], $data['height']);
    }

    /**
     * @return array{id: string, previewUrl: string, fullUrl: string, width: int, height: int}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'previewUrl' => $this->previewUrl,
            'fullUrl' => $this->fullUrl,
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
