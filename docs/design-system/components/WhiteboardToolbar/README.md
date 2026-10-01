Barre d'outils du whiteboard : sélection, main, post-it, forme, texte, crayon, connecteur, annuler/rétablir, zoom et minimap.

## Quand l'utiliser
- Tout canevas libre (whiteboard, board de rétro en mode libre). Horizontale en haut au centre ; verticale à gauche en variante ; zoom + minimap en bas.
- Mobile : barre horizontale en bas, outils réduits (sélection, main, post-it, texte).

## Anatomie
`sk-wbbar` (pilule `--popover`, `--shadow-raised`) · `sk-tool` 36 px avec lettre de raccourci en coin · séparateurs verticaux par famille (navigation | création | historique) · outil actif `is-on` (fond `--skrum-primary-soft`, liseré `--primary`) · sous-barre contextuelle (couleurs de post-it) · tooltip avec touche · barre de zoom (−, pourcentage cliquable = 100 %, +, ajuster, minimap) · `sk-minimap` avec rectangle de viewport.

## Props
```ts
type WbTool = "select" | "hand" | "sticky" | "shape" | "text" | "pen" | "connector";

interface WhiteboardToolbarProps {
  tool: WbTool;
  orientation?: "horizontal" | "vertical";
  stickyColor?: ColumnColor;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;                     // 1 = 100 %
  minimapOpen?: boolean;
  onToolChange: (t: WbTool) => void;
  onStickyColorChange?: (c: ColumnColor) => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (z: number) => void;      // 0.1 … 4
  onFit: () => void;
  onMinimapToggle: () => void;
}
```

## États
outil actif · survol · tooltip avec raccourci · sous-barre couleurs (post-it actif) · undo/redo désactivés · zoom 10 % – 400 % · minimap ouverte / fermée · verticale.

## Accessibilité & clavier
- `role="toolbar"` + `aria-orientation` ; <kbd>←</kbd>/<kbd>→</kbd> (ou <kbd>↑</kbd>/<kbd>↓</kbd>) entre outils, roving tabindex.
- Outils = `aria-pressed` ; `aria-label` inclut le raccourci (« Post-it (N) »).
- Raccourcis : <kbd>V</kbd> sélection · <kbd>H</kbd>/<kbd>Espace</kbd> maintenu main · <kbd>N</kbd> post-it · <kbd>R</kbd> forme · <kbd>T</kbd> texte · <kbd>P</kbd> crayon · <kbd>C</kbd> connecteur · <kbd>−</kbd>/<kbd>+</kbd> zoom · <kbd>Maj</kbd>+<kbd>1</kbd> ajuster · <kbd>M</kbd> minimap · <kbd>⌘/Ctrl</kbd>+<kbd>Z</kbd> annuler.
- Raccourcis inactifs pendant la saisie de texte.

## Temps réel
- L'outil et le zoom sont locaux (non diffusés). Les objets créés passent par `ObjectCreated/Updated/Deleted` sur `presence-whiteboard.{boardId}` ; le tracé crayon est diffusé en whisper `client-stroke` pendant le geste puis persisté à la fin.
- Undo/redo porte sur mes propres opérations uniquement.

## Mapping shadcn
`ToggleGroup type="single"` (`data-[state=on]:bg-(--skrum-primary-soft) data-[state=on]:text-(--skrum-primary-text)`), `Tooltip` + `Kbd`, `Separator orientation="vertical"`, `Button variant="ghost" size="icon"`.

## À faire / À éviter
- Faire : garder la barre centrée et flottante, jamais collée au bord.
- Éviter : plus de 10 outils visibles (le reste dans un menu) ; icônes sans tooltip.

## Tokens
`--popover` `--border` `--foreground` `--muted-foreground` `--accent` `--primary` `--skrum-primary-soft` `--skrum-primary-text` `--card` `--skrum-col-*` (sous-barre) `--skrum-canvas` `--skrum-canvas-dot` `--shadow-raised` `--radius-xl` `--radius-md` `--radius` `--font-mono` `--space-4`
