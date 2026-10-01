Navigation entre pages d'une liste : pagination numérotée, compacte, compteur avec taille de page, ou chargement progressif « Charger plus ».

**Quand l'utiliser**
- Numérotée : listes longues où l'on revient à une page précise (Action items, Estimation history, journaux d'admin).
- Compacte (« Page 3 sur 7 ») : mobile, pied de `Card`, carrousel de sessions.
- Compteur + taille de page : pied de `Table` (« 21–40 sur 128 », Lignes par page 10 / 20 / 50 / 100).
- « Charger plus » : flux chronologique (sessions récentes, notifications, mobile) ; pas de scroll infini sans bouton.

**Anatomie**
Numérotée : `nav` > liste → « Précédent » (chevron + libellé), pages 36 px (`--radius-md`), page courante en contour (`--card`, bord `--input`, `--shadow-card`, gras), ellipse `ellipsis` muted, « Suivant ». Sous 448 px de conteneur les libellés disparaissent (icônes seules) ; sous 320 px les pages intermédiaires se masquent. Compacte : 4 boutons icône outline 32 px + texte centré 13/600. Compteur : texte 13 muted avec plage en `--foreground` 650, libellé + `Select` 32 px (menu ouvert vers le haut en pied de page), flèches. Charger plus : bouton outline sm + badge « 20 de plus », état chargement (tréma, `aria-busy`), fin de liste `check-check` + total.

**Props**
```ts
interface PaginationProps {
  page: number; pageCount: number;
  onPageChange: (p: number) => void;
  siblingCount?: number;               // 1 par défaut → 1 … 3 4 5 … 7
  variant?: 'numbered' | 'compact';
  getHref?: (p: number) => string;     // liens Inertia (<Link preserveScroll>)
}
interface PageSizeBarProps {
  from: number; to: number; total: number;   // « 21–40 sur 128 »
  pageSize: 10 | 20 | 50 | 100; onPageSizeChange: (s: PageSizeBarProps['pageSize']) => void;
  onPrev: () => void; onNext: () => void;
}
interface LoadMoreProps { remaining: number; loading: boolean; onLoadMore: () => void; total: number; endLabel?: string }
```

**États**
Page courante, survol (`--accent`), focus clavier (anneau `--ring`), bord désactivé (Précédent sur la page 1, Suivant sur la dernière : opacité .5, `aria-disabled`), ellipse, Select de taille ouvert (option active `--accent`, coche sur la valeur), Charger plus : repos, chargement, fin de liste.

**Accessibilité & clavier**
- `<nav aria-label="Pagination">`, page courante `aria-current="page"`, liens `aria-label="Aller à la page 4"` ; boutons icône toujours nommés (« Page précédente »).
- Les bords désactivés restent dans le DOM (`aria-disabled`) pour garder la position des contrôles.
- Compteur « 21–40 sur 128 » en `aria-live="polite"` ; après « Charger plus », le focus va sur le premier élément ajouté ; conteneur `role="feed"` + `aria-busy` pendant le chargement.

**Temps réel**
Une action créée par un autre membre n'insère pas de ligne dans la page affichée : le total devient « 21–40 sur 129 » et une bannière propose « 1 nouvelle action — Actualiser ».

**À faire / À éviter**
- Faire : 20 éléments par page par défaut ; garder la page dans l'URL (`?page=3&per_page=20`) ; même hauteur de pagination sur toutes les pages.
- Éviter : pagination numérotée sous 3 pages (tout afficher) ; scroll infini dans une liste qui a un pied (réglages, liens) ; changer la taille de page sans revenir à la page 1.

**Tokens**
`--foreground` `--muted-foreground` `--card` `--input` `--accent` `--ring` `--border` `--popover` `--shadow-card` `--shadow-popover` `--radius-md` `--radius-xl` `--duration-fast` `--ease-standard`

**Mapping shadcn**
- `@/components/ui/pagination` (`Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`) ; `PaginationLink` rendu par `<Link>` d'Inertia (`asChild`). Taille de page : `@/components/ui/select`.
- Link : `buttonVariants({ variant: isActive ? 'outline' : 'ghost', size: 'icon' })` + `min-w-9 tabular-nums` ; actif `font-bold shadow-card` ; désactivé `pointer-events-none opacity-50`.
- Previous/Next : `gap-1 px-2.5` ; libellé `hidden @md/pg:inline` dans un conteneur `@container/pg` ; pages intermédiaires `hidden @xs/pg:flex`.
- Compteur : `text-body-sm text-muted-foreground tabular-nums` + `<b className="font-title text-foreground">` ; Select `h-8 w-18` ; `SelectContent side="top"`.
- Charger plus : `Button variant="outline" size="sm"` + `Badge variant="secondary"` ; fin : `text-body-sm text-muted-foreground`.
