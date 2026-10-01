Panneau latéral droit sur overlay pour consulter et éditer un objet sans quitter la page (ici « Détails de l'action »).

**Quand l'utiliser**
- Détail d'une action, d'une carte, d'un participant depuis une liste ou un board.
- Réglages de session secondaires pendant une rétro (le board reste visible en fond).
- Formulaire court → `Dialog` ; mobile → `Drawer` (le Sheet passe en plein écran sous 640 px).

**Anatomie**
Overlay → panneau 420 px, `--popover`, bord gauche `--border`, `--shadow-modal` → en-tête (ticket lié `sk-ticket`, badge de statut, titre, méta, bouton fermer) séparé par `--border` → corps défilant : propriétés en grille libellé/valeur (responsable, échéance, priorité, suiveurs), carte d'origine (`sk-rcard` dans sa couleur de colonne), historique → pied collant : action principale, secondaire, menu « … ».

**Props**
```ts
interface ActionSheetProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  action: {
    id: string; title: string; status: 'todo' | 'doing' | 'done';
    ticket?: { key: string; url: string };
    assignee?: Member; dueAt?: string; priority: 'low' | 'medium' | 'high';
    watchers: Member[]; originCard?: RetroCard; history: HistoryEntry[];
  };
  onUpdate: (patch: Partial<ActionSheetProps['action']>) => void;
  side?: 'right' | 'left';
}
```

**États**
Ouvert (glisse depuis la droite, `--duration-slow` `--ease-enter`), champ en édition (Select/Combobox inline), échéance en retard (`sk-due is-late`), enregistrement (le champ modifié affiche un spinner discret), lecture seule (invité : pas de pied).

**Accessibilité & clavier**
- `role="dialog"`, `aria-modal`, `aria-labelledby` sur le titre ; focus initial sur le titre (lecture) ou le bouton fermer.
- `Esc` ferme ; focus rendu à la ligne de la table qui l'a ouvert.
- Les propriétés sont un `<dl>` ; les icônes de libellé sont décoratives.

**Temps réel**
Les modifications d'un autre membre s'appliquent en direct avec un flash `--skrum-primary-soft` sur le champ ; si l'action est supprimée ailleurs, afficher une alerte inline et désactiver le pied.

**À faire / À éviter**
- Faire : sauvegarde automatique par champ + toast « Annuler » pour les changements de statut.
- Éviter : imbriquer un Sheet dans un Sheet ; des onglets profonds dans le panneau.

**Tokens**
`--popover` `--border` `--muted-foreground` `--foreground` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-destructive-text` `--skrum-col-lagoon*` `--skrum-presence-*` `--shadow-modal` `--radius-xl` `--space-4` `--space-5` `--space-6` `--duration-slow` `--ease-enter` `--z-overlay`

**Mapping shadcn**
- `@/components/ui/sheet` avec `side="right"`, `SheetHeader`, `SheetTitle`, `SheetDescription`, `SheetFooter`.
- Content : `w-105 sm:max-w-105 p-0 gap-0 bg-popover border-l shadow-modal` ; header `px-6 pt-5 pb-4 border-b` ; body `flex-1 overflow-y-auto px-6 py-5 space-y-4` ; footer `sticky bottom-0 border-t bg-popover px-6 py-4 flex gap-2`.
- Grille : `grid grid-cols-[--spacing(27.5)_1fr] gap-x-3 gap-y-2 items-center` ; libellés `text-body-sm text-muted-foreground`.
