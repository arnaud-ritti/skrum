Bouton d'action Skrüm : le `Button` shadcn/ui (new-york) thémé terracotta, en 6 variantes et 4 tailles.

## Quand l'utiliser
- Déclencher une action (créer une rétro, révéler, passer à la phase suivante). Pour naviguer, utilisez un lien (`asChild` + `<Link>` Inertia).
- **Une seule** variante `default` (primaire) par zone ; les autres actions en `outline`, `secondary` ou `ghost`.
- `destructive` uniquement pour une suppression définitive, toujours suivie d'un `AlertDialog`.

## Anatomie
Conteneur (hauteur fixe, rayon `--radius-md`) · icône lucide optionnelle (16 px, avant le libellé, ou après pour « suivant ») · libellé en français, verbe à l'infinitif · indicateur de chargement (spinner ou tréma) qui remplace l'icône.

## Variantes
| Variante | Usage | Exemple |
|---|---|---|
| `default` | action principale | « Nouvelle rétro », « Phase suivante » |
| `secondary` | action principale alternative, fond sauge | « Rejoindre » |
| `outline` | action secondaire sur carte/fond | « Partager le lien » |
| `ghost` | barres d'outils, actions tertiaires | « Annuler », icônes de colonne |
| `destructive` | suppression irréversible | « Supprimer la session » |
| `link` | action inline dans du texte | « Voir toutes les actions » |

## Tailles
`sm` 32 px (barres, cartes) · `default` 36 px · `lg` 44 px (CTA d'écran, mobile — respecte `--touch-target`) · `icon` carré 36 px (combinable : `icon` + `sm` = 32, `icon` + `lg` = 44).

## Props
```ts
import type { VariantProps } from "class-variance-authority";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
type ButtonSize = "sm" | "default" | "lg" | "icon" | "icon-sm" | "icon-lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;          // défaut "default"
  size?: ButtonSize;                // défaut "default"
  asChild?: boolean;                // rend l'enfant (Radix Slot), ex. <Link> Inertia
  loading?: boolean;                // extension Skrüm : désactive + affiche le loader
  loader?: "spinner" | "trema";     // "trema" pour les attentes réseau (Reverb)
  "aria-label"?: string;            // obligatoire si size="icon*"
}
```

## États
défaut · survol (fond mélangé 14 % vers `--foreground`) · actif (translateY 1 px) · focus clavier (anneau 2 px `--ring`, offset 2 px) · désactivé (opacité .5, pas d'ombre, `disabled`) · chargement (spinner « Création… » ou tréma « Connexion »).

## Accessibilité & clavier
- `<button type="button">` natif : <kbd>Entrée</kbd> et <kbd>Espace</kbd> activent.
- Bouton icône : `aria-label` en français obligatoire + `Tooltip` avec le raccourci.
- En chargement : `aria-busy="true"`, libellé qui change (« Création… ») et `disabled` pour éviter le double envoi.
- Contraste texte/fond ≥ 4.5:1 garanti par les paires `--primary`/`--primary-foreground` dans les deux thèmes.

## Mapping shadcn
- Composant : `@/components/ui/button` (`Button`, `buttonVariants`), non forké ; seule la variante `loading` est ajoutée via un wrapper `@/components/skrum/loading-button`.
- `default` → `bg-primary text-primary-foreground shadow-xs hover:bg-primary/90`
- `secondary` → `bg-secondary text-secondary-foreground hover:bg-secondary/80`
- `outline` → `border border-input bg-card shadow-xs hover:bg-accent hover:text-accent-foreground`
- `ghost` → `hover:bg-accent hover:text-accent-foreground`
- `destructive` → `bg-destructive text-destructive-foreground hover:bg-destructive/90`
- `link` → `text-(--skrum-primary-text) underline-offset-4 underline`
- Tailles → `h-8 px-3` / `h-9 px-4` / `h-11 px-6 rounded-lg` / `size-9` ; focus → `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

## À faire / À éviter
- Faire : libellés courts et explicites (« Révéler les cartes » plutôt que « OK »).
- Faire : icône + libellé pour les actions clés, icône seule uniquement en barre d'outils.
- Éviter : deux boutons `default` côte à côte ; `link` pour une action destructive ; désactiver sans expliquer pourquoi (ajouter un `Tooltip`).

## Tokens
`--primary` `--primary-foreground` `--secondary` `--secondary-foreground` `--card` `--input` `--accent` `--accent-foreground` `--destructive` `--destructive-foreground` `--foreground` `--ring` `--skrum-primary-text` `--radius-md` `--radius` `--shadow-card` `--duration-fast` `--duration-instant` `--ease-standard` `--space-2` `--space-3` `--space-4` `--space-6` `--touch-target`
