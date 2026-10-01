Palette de commandes globale (⌘K / Ctrl K) : chercher, lancer une action, rouvrir une session récente, naviguer.

**Quand l'utiliser**
- Accès clavier rapide à tout : « Nouvelle rétro », sessions récentes, pages de paramètres.
- Base du `Combobox` (mêmes primitives) pour les listes filtrables.
- Pas pour des actions contextuelles d'un objet → `DropdownMenu`.

**Anatomie**
Dialog 560 px sur overlay, `--radius-xl`, `--shadow-modal` → champ de recherche 48 px (icône `search`, `Esc` en `sk-kbd`) → liste groupée : titres de groupe 12/600 (« Actions », « Sessions récentes », « Aller à »), items 36 px avec pastille d'icône 24 px, correspondance en gras, méta ou raccourci à droite → item actif `--accent` → pied `--muted` avec aides clavier et nombre de résultats.

**Props**
```ts
interface CommandItem { id: string; group: 'actions' | 'recent' | 'goto'; label: string; icon: LucideIcon; meta?: string; shortcut?: string[]; keywords?: string[]; onSelect: () => void }
interface CommandPaletteProps { open: boolean; onOpenChange: (o: boolean) => void; items: CommandItem[]; placeholder?: string; emptyText?: string; loading?: boolean }
```

**États**
Vide (sessions récentes + actions suggérées), recherche filtrée avec surlignage, item actif, chargement (`sk-trema` dans la liste), aucun résultat (« Aucun résultat pour « … » » + suggestion).

**Accessibilité & clavier**
- `⌘K` / `Ctrl K` ouvre partout sauf dans un champ en cours d'édition ; `/` en alternative.
- Focus dans le champ ; `↑ ↓` changent l'item actif (`aria-activedescendant`), `Entrée` exécute, `Esc` ferme.
- Groupes `role="group"` + `aria-labelledby` ; le nombre de résultats est annoncé en `aria-live="polite"`.
- Les raccourcis en séquence (`G` puis `A`) sont listés aussi dans l'aide clavier.

**Temps réel**
« Sessions récentes » marque d'un badge « En direct » une session en cours et la place en premier.

**À faire / À éviter**
- Faire : libellés commençant par un verbe pour les actions ; ≤ 5 items par groupe avant « Voir plus ».
- Éviter : actions destructives dans la palette sans confirmation ; recherche serveur sans debounce (150 ms).

**Tokens**
`--popover` `--border` `--muted` `--muted-foreground` `--accent` `--accent-foreground` `--card` `--foreground` `--shadow-modal` `--radius-xl` `--radius-sm` `--font-mono` `--duration-slow` `--ease-enter` `--z-overlay`

**Mapping shadcn**
- `@/components/ui/command` (cmdk) dans `CommandDialog` : `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup heading="Actions"`, `CommandItem`, `CommandShortcut`, `CommandSeparator`.
- Dialog : `max-w-140 rounded-xl p-0 overflow-hidden shadow-modal`. Input : `h-12 text-ui-lg border-b`. Item : `h-9 gap-2 rounded-sm px-2 data-[selected=true]:bg-accent`. `[cmdk-group-heading]` : `px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground`.
- Pied (hors cmdk) : `flex gap-4 border-t bg-muted px-3.5 py-2 text-xs text-muted-foreground`.
