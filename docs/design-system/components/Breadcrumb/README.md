Fil d'Ariane indiquant la position dans la hiérarchie (équipe › module › session) et permettant de remonter.

**Quand l'utiliser**
- Pages à 2+ niveaux : session dans un module, sous-pages de paramètres, admin d'instance.
- Dans la topbar des écrans de session, à droite du bouton de repli de la sidebar.
- Pas sur la page d'accueil ni pour des étapes (→ `PhaseStepper`).

**Anatomie**
Liste `ol` 14 px `--muted-foreground` → liens → séparateur `chevron-right` 14 px (ou « / » en contexte dense) → page courante `--foreground` 600. Ellipse repliée (bouton 24 px) qui ouvre un `DropdownMenu` des niveaux masqués. Icône maison optionnelle en premier (avec texte masqué). Mobile : lien retour `chevron-left` vers le parent + titre tronqué.

**Props**
```ts
interface BreadcrumbProps {
  items: { label: string; href?: string; icon?: LucideIcon }[]; // dernier = page courante
  maxItems?: number;          // au-delà : ellipse + menu (défaut 4)
  separator?: 'chevron' | 'slash';
  collapseOnMobile?: boolean; // parent + courant uniquement
}
```

**États**
Lien au repos, survol (souligné, `--foreground`), focus (anneau `--ring`), ellipse ouverte, page courante, tronqué (`text-overflow: ellipsis` + `title`).

**Accessibilité & clavier**
- `<nav aria-label="Fil d'Ariane">`, page courante `aria-current="page"` (non cliquable), séparateurs `aria-hidden`.
- Icône seule : texte en `sr-only` (« Accueil »). Ellipse : `aria-label="Afficher le chemin complet"`.

**Temps réel**
Le nom d'une session renommée par le facilitateur se met à jour dans le fil sans rechargement.

**À faire / À éviter**
- Faire : libellés identiques aux titres des pages cibles.
- Éviter : répéter le titre H1 juste en dessous en plus grand ; plus de 4 niveaux visibles.

**Tokens**
`--muted-foreground` `--foreground` `--accent` `--ring` `--border` `--popover` `--radius-xs` `--radius-sm` `--topbar-height`

**Mapping shadcn**
- `@/components/ui/breadcrumb` : `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink` (avec Inertia `<Link>` via `asChild`), `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis` + `@/components/ui/dropdown-menu`.
- List : `gap-1.5 text-sm text-muted-foreground` ; Link : `hover:text-foreground hover:underline underline-offset-3 focus-visible:ring-2 focus-visible:ring-ring rounded-xs` ; Page : `font-semibold text-foreground` ; Separator `[&>svg]:size-3.5`.
