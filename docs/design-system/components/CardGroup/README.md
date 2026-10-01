Groupe de cartes : regroupe des `RetroCard` similaires sous un titre éditable, déplié ou replié en pile.

## Quand l'utiliser
- Phase Regroupement (création par glisser une carte sur une autre) puis phases Vote et Discussion (on vote sur le groupe).
- Pas pour un simple tri visuel : un groupe a un titre et un total de votes.

## Anatomie
Conteneur (teinte `--c` 55 % sur `--card`, bordure 1,5 px `--c-b`) · en-tête : chevron replier/déplier, titre éditable (clic), compteur de cartes · pile de cartes (dépliée : liste ; repliée : 3 cartes empilées avec décalage et rotation) · pied : total de votes ou avatars des auteurs.

## Props
```ts
interface CardGroupProps {
  id: string;
  title: string;                    // défaut : texte de la 1re carte tronqué
  color: "sun" | "apricot" | "coral" | "plum" | "iris" | "sky" | "lagoon" | "moss";
  cards: RetroCardProps[];
  collapsed?: boolean;
  editingTitle?: boolean;
  votes?: { total: number | null; mine: number };
  canEdit?: boolean;                // tout participant en Regroupement, facilitateur ensuite
  onToggle?: (collapsed: boolean) => void;
  onRename?: (title: string) => void;
  onUngroup?: (cardId: string) => void; // sortir une carte du groupe
}
```

## États
déplié (titre éditable au survol) · replié en pile (première carte lisible, les autres en tranche) · titre en édition (anneau `--ring`, <kbd>↵</kbd> valider, <kbd>Échap</kbd> annuler) · cible de drop (anneau `--c-t` pointillé).

## Accessibilité & clavier
- `<section aria-label="Groupe : {titre}, {n} cartes">` ; bouton chevron avec `aria-expanded`.
- <kbd>Entrée</kbd> sur le titre → édition ; <kbd>Entrée</kbd> valide, <kbd>Échap</kbd> annule.
- Regroupement au clavier : sélectionner une carte (<kbd>Espace</kbd>), puis <kbd>G</kbd> sur la carte cible.
- Replié : les cartes cachées restent dans l'arbre d'accessibilité (`aria-hidden` seulement sur les tranches décoratives).

## Temps réel
- `GroupCreated`, `GroupUpdated` (titre, ordre), `GroupDissolved` sur `presence-retro.{sessionId}`.
- Édition du titre : même verrou doux que `RetroCard` (whisper `client-group.editing`).
- Replier/déplier est local à chaque participant (non diffusé), sauf quand le facilitateur met le groupe en focus.

## À faire / À éviter
- Faire : proposer un titre par défaut pour éviter « Groupe sans nom ».
- Faire : garder l'ombre des cartes internes à zéro (le groupe porte la profondeur).
- Éviter : groupes imbriqués ; groupes multicolores (le groupe prend la couleur de sa colonne).

## Tokens
`--c` `--c-b` `--c-t` (via `sk-c-*`) `--card` `--foreground` `--muted-foreground` `--ring` `--radius-xl` `--radius-sm` `--radius-full` `--space-2` `--space-3` `--shadow-card`
