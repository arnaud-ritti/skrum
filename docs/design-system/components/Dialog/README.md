Fenêtre modale centrée sur overlay : confirmation d'une action irréversible (`AlertDialog`) ou formulaire court (`Dialog`).

**Quand l'utiliser**
- Confirmation destructive (supprimer une session, retirer un membre) → `AlertDialog`, jamais fermable par clic extérieur.
- Création rapide ≤ 5 champs (« Nouvelle rétro », renommer) → `Dialog`.
- Contenu long ou consultation contextuelle → `Sheet` ; mobile → `Drawer`.

**Anatomie**
Overlay (voile sombre + flou 2 px) → panneau `--popover`, `--radius-xl`, `--shadow-modal`, padding 24 → pastille d'icône (destructif : `--skrum-destructive-soft`/`-text`) → titre 18/650 → description → récapitulatif de ce qui sera perdu (`--muted`) → pied aligné à droite (secondaire puis principal). Bouton fermer ghost en haut à droite pour les formulaires.

**Props**
```ts
interface ConfirmDialogProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  title: string; description: string;
  consequences?: { icon: LucideIcon; label: string }[];
  confirmLabel: string;           // verbe explicite : « Supprimer »
  tone?: 'default' | 'destructive';
  onConfirm: () => Promise<void>;
}
interface FormDialogProps {
  open: boolean; onOpenChange: (o: boolean) => void;
  title: string; description?: string;
  submitLabel: string; onSubmit: (data: FormData) => Promise<void>;
  children: React.ReactNode;       // champs
}
```

**États**
Ouvert (entrée `--duration-slow` `--ease-enter`), focus initial (sur « Annuler » pour un destructif, sur le 1ᵉʳ champ pour un formulaire), champ en erreur, soumission en cours (bouton avec spinner, pied désactivé), fermeture (`--ease-exit`).

**Accessibilité & clavier**
- `role="alertdialog"` (confirmation) ou `dialog`, `aria-modal`, `aria-labelledby` / `aria-describedby`.
- Focus piégé, `Esc` ferme (sauf pendant la soumission), focus rendu au déclencheur.
- `Entrée` soumet le formulaire ; jamais sur le bouton destructif par défaut.

**Temps réel**
Si la session est supprimée par un autre facilitateur pendant que le dialog est ouvert, remplacer le contenu par un message d'info et un seul bouton « Fermer ».

**À faire / À éviter**
- Faire : titre en question précise (« Supprimer « Rétro sprint 42 » ? »), conséquences chiffrées.
- Éviter : « Êtes-vous sûr ? » / « OK » ; empiler deux dialogs ; plus d'un bouton principal.

**Tokens**
`--popover` `--popover-foreground` `--border` `--muted` `--muted-foreground` `--destructive` `--destructive-foreground` `--skrum-destructive-soft` `--skrum-destructive-text` `--primary` `--ring` `--shadow-modal` `--radius-xl` `--space-4` `--space-6` `--duration-slow` `--ease-enter` `--ease-exit` `--z-overlay`

**Mapping shadcn**
- `@/components/ui/alert-dialog` (confirmation), `@/components/ui/dialog` (formulaire).
- Overlay : `fixed inset-0 z-50 bg-skrum-scrim backdrop-blur-xs`. Content : `max-w-110 rounded-xl border bg-popover p-6 shadow-modal gap-4`.
- Titre `text-lg font-semibold`, description `text-sm text-muted-foreground`. Footer `flex justify-end gap-2`.
- Action destructive : `<AlertDialogAction className={buttonVariants({ variant: 'destructive' })}>` ; pastille `size-10 rounded-full bg-skrum-destructive-soft text-skrum-destructive-text`.
