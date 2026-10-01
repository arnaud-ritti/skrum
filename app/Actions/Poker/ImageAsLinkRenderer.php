<?php

namespace App\Actions\Poker;

use InvalidArgumentException;
use League\CommonMark\Environment\EnvironmentBuilderInterface;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\Extension\ExtensionInterface;
use League\CommonMark\Node\Node;
use League\CommonMark\Renderer\ChildNodeRendererInterface;
use League\CommonMark\Renderer\NodeRendererInterface;
use League\CommonMark\Util\HtmlElement;
use League\CommonMark\Util\Xml;

/**
 * An <img> would make every viewer's browser contact the image host, so
 * images become plain links to the image, labelled with the alt text.
 */
class ImageAsLinkRenderer implements ExtensionInterface, NodeRendererInterface
{
    public function register(EnvironmentBuilderInterface $environment): void
    {
        $environment->addRenderer(Image::class, $this, 10);
    }

    public function render(Node $node, ChildNodeRendererInterface $childRenderer): \Stringable|string
    {
        throw_unless($node instanceof Image, InvalidArgumentException::class, 'Incompatible node type: '.$node::class);

        $alt = $childRenderer->renderNodes($node->children());
        $url = trim($node->getUrl());

        if (preg_match('#^https?://#i', $url) !== 1) {
            return $alt;
        }

        return new HtmlElement('a', [
            'href' => $url,
            'rel' => 'nofollow noopener noreferrer',
            'target' => '_blank',
        ], $alt === '' ? Xml::escape($url) : $alt);
    }
}
