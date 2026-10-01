Étiquette compacte non interactive pour un statut, un rôle, une catégorie ou un compteur.

**Quand l'utiliser**
- Rôle (Facilitateur, Invité, Anonyme), statut (Consensus, En retard, En direct, Faite), compteur (6 actions).
- Pas pour une action (→ `Button`), ni pour un filtre retirable (→ bouton ghost avec `x`).

**Anatomie**
22 px de haut, padding 0 8, `--radius-sm` (pill : `--radius-full`), 12/600, icône 12 px à 4 px, point `sk-dot` 8 px optionnel. Variantes : default (`--primary`), secondary (`--secondary`), outline (bord `--border`), muted, soft (`--skrum-primary-soft`), success, warning, info, destructive (fonds `*-soft` + textes `*-text`).

**Props**
```ts
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'muted' | 'soft' | 'success' | 'warning' | 'info' | 'destructive';
  shape?: 'rounded' | 'pill';
  icon?: LucideIcon;
  dot?: string;        // token de couleur du point, ex. 'var(--skrum-success)'
  asChild?: boolean;   // lien
}
```

**États**
Statique ; en lien (`asChild`) : survol `--accent` + icône `arrow-up-right`, focus anneau `--ring`.

**Exemples métier**
- Facilitateur → soft + `crown` ; Invité → outline + `user-round` ; Anonyme → muted + `venetian-mask`.
- Consensus → success + `check` ; En retard → destructive + `calendar-clock` ; Écart de vote → warning + `triangle-alert`.

**Accessibilité & clavier**
- Le texte porte le sens ; les couleurs de statut sont toujours accompagnées d'une icône ou d'un mot.
- Compteur seul : `aria-label` complet (« 6 actions en cours »).
- Contraste AA garanti par les paires `*-soft` / `*-text` sur les deux thèmes.

**Temps réel**
Un statut qui change (En direct → Terminée) change de variante sans animation de couleur ; un compteur qui augmente peut pulser une fois (`--duration-base`).

**À faire / À éviter**
- Faire : 1–2 mots ; une seule variante « forte » (default) par zone.
- Éviter : réutiliser success/warning/destructive pour une catégorie ; badge destructif pour un simple « 0 ».

**Tokens**
`--primary` `--primary-foreground` `--secondary` `--secondary-foreground` `--border` `--foreground` `--muted` `--muted-foreground` `--skrum-primary-soft` `--skrum-primary-text` `--skrum-success-soft` `--skrum-success-text` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-info-soft` `--skrum-info-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--skrum-success` `--accent` `--radius-sm` `--radius-full`

**Mapping shadcn**
- `@/components/ui/badge` avec `cva` étendu.
- Base : `inline-flex h-5.5 items-center gap-1 rounded-sm border border-transparent px-2 text-xs font-semibold [&>svg]:size-3`.
- Variantes : `default: bg-primary text-primary-foreground` · `secondary: bg-secondary text-secondary-foreground` · `outline: border-border text-foreground` · `muted: bg-muted text-muted-foreground` · `soft: bg-skrum-primary-soft text-skrum-primary-text` · `success: bg-skrum-success-soft text-skrum-success-text` · `warning: bg-skrum-warning-soft text-skrum-warning-text` · `info: bg-skrum-info-soft text-skrum-info-text` · `destructive: bg-skrum-destructive-soft text-skrum-destructive-text` ; `shape: { pill: 'rounded-full' }`.
