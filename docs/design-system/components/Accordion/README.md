Sections repliables : `Accordion` (liste de sections, une ou plusieurs ouvertes) et `Collapsible` (un seul bloc masquable derrière un déclencheur).

**Quand l'utiliser**
- Accordion `single` : FAQ de la landing, aide contextuelle — une réponse à la fois.
- Accordion `multiple` : paramètres de session (Timer et phases, Vote, Anonymat), réglages d'équipe longs ; un résumé de la valeur courante reste visible replié.
- `Collapsible` : détail secondaire d'un bloc, ex. « Rounds (2) » sous la tâche du poker, historique d'une action.
- Contenu à comparer côte à côte → `Tabs` ; contenu critique → toujours visible, jamais replié.

**Anatomie**
Accordion : items séparés par `--border` → déclencheur pleine largeur (titre 14/600, padding 16 vertical, chevron 16 `--muted-foreground` qui pivote de 180°) → panneau (14/22 `--muted-foreground`, padding bas 16). Variante paramètres dans une `Card` : icône 28 px sur `--muted` (`--skrum-primary-soft` ouvert), titre, résumé 12 px à droite, panneau de formulaire en `--foreground`. Collapsible : déclencheur ghost 32 px (icône `history`, « Rounds (2) », chevron) → liste de rounds (`--background`, bord, `--radius`) avec badge de résultat et mini-cartes.

**Props**
```ts
interface AccordionItemDef { value: string; title: string; summary?: string; icon?: LucideIcon; disabled?: boolean; content: React.ReactNode }
type AccordionProps =
  | { type: 'single'; collapsible?: boolean; value?: string; onValueChange?: (v: string) => void; items: AccordionItemDef[]; variant?: 'plain' | 'card' }
  | { type: 'multiple'; value?: string[]; onValueChange?: (v: string[]) => void; items: AccordionItemDef[]; variant?: 'plain' | 'card' };
interface CollapsibleProps { open?: boolean; defaultOpen?: boolean; onOpenChange?: (o: boolean) => void; trigger: { icon?: LucideIcon; label: string; count?: number }; children: React.ReactNode }
interface PokerRound { n: number; votes: { userId: string; value: string }[]; outcome: 'consensus' | 'spread'; min?: string; max?: string }
```

**États**
Fermé, ouvert (chevron pivoté), survol (titre souligné ; variante carte : fond `--muted`), focus clavier (anneau `--ring`), désactivé (opacité .5, non souligné). Collapsible : replié / déplié, survol `--accent`, focus.

**Accessibilité & clavier**
- Déclencheur = `<button>` dans un titre (`h3`), `aria-expanded`, `aria-controls` ; panneau `role="region"` + `aria-labelledby`.
- `Entrée` / `Espace` bascule ; `↑ ↓` passent d'un déclencheur à l'autre, `Début / Fin` au premier / dernier (Radix).
- Le compteur fait partie du libellé (« Rounds (2) ») ; le résumé replié est lu après le titre.
- Animation `--duration-base` `--ease-standard` désactivée avec `prefers-reduced-motion`.

**Temps réel**
Un nouveau round (re-vote) incrémente le compteur « Rounds (n) » sans ouvrir le bloc ; un paramètre modifié par le facilitateur met à jour le résumé de l'item replié.

**À faire / À éviter**
- Faire : titres sous forme de question (FAQ) ou de nom court (paramètres) ; résumé de la valeur courante sur les items de paramètres.
- Éviter : imbriquer des accordéons ; un seul item (→ `Collapsible`) ; replier une erreur de formulaire (ouvrir l'item fautif).

**Tokens**
`--border` `--foreground` `--muted` `--muted-foreground` `--accent` `--card` `--background` `--skrum-primary-soft` `--skrum-primary-text` `--ring` `--radius` `--radius-md` `--radius-sm` `--duration-base` `--ease-standard` `--font-display`

**Mapping shadcn**
- `@/components/ui/accordion` (`Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`) et `@/components/ui/collapsible`.
- Item : `border-b last:border-b-0` ; Trigger : `flex flex-1 items-start gap-3 py-4 text-sm font-semibold hover:underline underline-offset-3 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&[data-state=open]>svg]:rotate-180` ; Content : `text-sm/snug text-muted-foreground pb-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up`.
- Variante carte : Trigger **inséré** `m-1 w-auto rounded-md px-3 py-2 hover:bg-muted hover:no-underline` (le survol ne touche jamais les bords de la carte ni le contenu ; texte aligné sur le panneau), Content `px-4 pt-1 pb-4` (petit écart de 0.5rem sous le survol, pas plus) ; icône `size-7 rounded-sm bg-muted group-data-[state=open]:bg-skrum-primary-soft group-data-[state=open]:text-skrum-primary-text` ; résumé `text-xs font-medium text-muted-foreground`.
- Collapsible : `CollapsibleTrigger asChild` → `Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-body-sm text-muted-foreground"` ; round : `rounded-lg border bg-background p-3`.
