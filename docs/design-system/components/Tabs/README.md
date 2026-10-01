Onglets pour basculer entre vues d'un même contexte, en deux styles : pilule (segmenté) et ligne (soulignée).

**Quand l'utiliser**
- Pilule : bascule de vue compacte (Tableau / Groupes / Actions, thème, étape mobile Écrire / Voter / Discuter).
- Ligne : sections de page (paramètres d'équipe, filtres de statut avec compteurs).
- Étapes séquentielles d'une session → `PhaseStepper` ; navigation entre pages → `Sidebar`.

**Anatomie**
Pilule : conteneur `--muted`, padding 3, `--radius` ; onglet 30 px 13/600, actif sur `--card` + `--shadow-card`. Ligne : bordure basse `--border`, onglets 40 px, actif souligné 2 px `--primary`. Icône 14 px et compteur pastille optionnels (actif : `--skrum-primary-soft`).

**Props**
```ts
interface TabsProps<T extends string> {
  value: T; onValueChange: (v: T) => void;
  items: { value: T; label: string; icon?: LucideIcon; count?: number; disabled?: boolean }[];
  variant?: 'pill' | 'line';
  fullWidth?: boolean;           // mobile
  'aria-label': string;
}
```

**États**
Actif, survol (texte `--foreground` ; ligne : soulignement `--border`), focus clavier (anneau `--ring`), désactivé (opacité .5), avec compteur.

**Accessibilité & clavier**
- `role="tablist"` + `aria-label`, `role="tab"` + `aria-selected` + `aria-controls`, panneau `role="tabpanel"`.
- `← →` déplacent la sélection (activation automatique), `Début/Fin`, un seul arrêt de tabulation.
- Le compteur est lu avec le libellé (« À faire, 6 »).

**Temps réel**
Les compteurs (actions en retard, cartes par vue) se mettent à jour en direct sans changer l'onglet actif.

**À faire / À éviter**
- Faire : 2 à 6 onglets, libellés d'un ou deux mots.
- Éviter : mélanger pilule et ligne au même niveau ; onglets qui déclenchent une action (→ bouton).

**Tokens**
`--muted` `--muted-foreground` `--card` `--foreground` `--border` `--primary` `--ring` `--skrum-primary-soft` `--skrum-primary-text` `--shadow-card` `--radius` `--radius-md` `--space-4`

**Mapping shadcn**
- `@/components/ui/tabs` : `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`.
- Pilule (défaut) : List `h-9 rounded-lg bg-muted p-0.75` ; Trigger `h-7.5 rounded-md px-3 text-body-sm font-semibold text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-card focus-visible:ring-2 focus-visible:ring-ring`.
- Ligne (variante `line`) : List `h-auto rounded-none bg-transparent p-0 border-b gap-4` ; Trigger `h-10 rounded-none px-0.5 data-[state=active]:shadow-[inset_0_-2px_0_var(--primary)] data-[state=active]:bg-transparent`.
