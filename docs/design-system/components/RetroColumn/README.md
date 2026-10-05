Colonne de rétrospective : en-tête coloré (pastille, titre, compteur, menu), pile de cartes, zone de dépôt et bouton « Ajouter une carte ».

## Quand l'utiliser
- Plateau de rétro (phases Écriture, Regroupement, Vote, Discussion), 2 à 6 colonnes côte à côte, défilement horizontal au-delà.
- Mobile : une colonne à la fois, onglets de colonnes au-dessus.

## Anatomie
Conteneur teinté (`--c` mélangé 38 % au canevas, bordure `--c-b` 45 %) · en-tête : pastille `sk-column-swatch`, titre (`h3`), compteur (pastille `--c`/`--c-t`), menu « … » · liste de `RetroCard` / `CardGroup` · zone de drop (pointillés `--c-t`, visible pendant un drag au-dessus de la colonne) · état vide (icône + phrase d'invitation) · bouton « Ajouter une carte » (pointillés `--c-b`).

## Palette des 8 couleurs
`sun` (Merci) · `apricot` (Continuer) · `coral` (Arrêter / À améliorer) · `plum` (Risques) · `iris` (Questions) · `sky` (Idées) · `lagoon` (Apprendre) · `moss` (Réussites). Les libellés sont des défauts des modèles ; la couleur est choisie par le facilitateur. Dans une même rétro, ne jamais répéter une couleur.

## Props
```ts
type ColumnColor = "sun" | "apricot" | "coral" | "plum" | "iris" | "sky" | "lagoon" | "moss";

interface RetroColumnProps {
  id: string;
  title: string;
  color: ColumnColor;
  description?: string;             // consigne affichée en tooltip
  count: number;                    // cartes visibles (masquées incluses)
  children: React.ReactNode;        // RetroCard | CardGroup
  canAdd?: boolean;                 // false si board verrouillé ou phase ≠ Écriture
  isDropTarget?: boolean;           // drag en cours au-dessus
  emptyHint?: string;               // « Pas encore de carte… »
  onAdd?: () => void;
  onRename?: (title: string) => void;   // facilitateur
  onColorChange?: (c: ColumnColor) => void;
  onSort?: (by: "votes" | "date") => void;
}
```

## États
avec cartes · zone de drop active · vide · ajout désactivé (board verrouillé : bouton masqué, cadenas dans l'en-tête) · titre en édition (facilitateur).

## Accessibilité & clavier
- `<section aria-labelledby>` pointant sur le titre ; le compteur est annoncé (« 3 cartes »).
- <kbd>N</kbd> ajoute une carte dans la colonne qui a le focus ; <kbd>←</kbd>/<kbd>→</kbd> passent d'une colonne à l'autre ; <kbd>↑</kbd>/<kbd>↓</kbd> parcourent les cartes.
- Zone de drop : `role="status"` + annonce dnd-kit « Déposer dans À améliorer, position 2 ».
- Pastille et compteur doublent la couleur par du texte : la couleur n'est jamais seule.

## Temps réel
- Canal `presence-retro.{sessionId}` ; `ColumnUpdated` (titre, couleur, ordre), `CardCreated`/`CardMoved` mettent à jour le compteur.
- Le compteur inclut les cartes masquées des autres (on sait combien, pas quoi) pour montrer l'activité pendant l'écriture.

## À faire / À éviter
- Faire : largeur fixe `--column-width` (300 px) ; sur écran étroit, défilement horizontal avec accroche.
- Faire : état vide actionnable (« Sois le premier à écrire »).
- Éviter : titre de colonne coloré en `--c-t` — il reste en `--foreground`.
- Éviter : plus de 6 colonnes (lisibilité et palette).

## Tokens
`--skrum-col-{sun|apricot|coral|plum|iris|sky|lagoon|moss}` + `-border` + `-text` (via `sk-c-*`) `--skrum-canvas` `--card` `--foreground` `--muted-foreground` `--input` `--border` `--radius-xl` `--radius` `--radius-sm` `--column-width` `--space-2` `--space-3` `--space-5` `--space-6` `--shadow-card`
