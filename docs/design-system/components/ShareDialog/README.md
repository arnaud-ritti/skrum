Dialog « Inviter à la session » : lien copiable, QR code, code court, rôle par défaut, invités anonymes, expiration, invitation de membres de l'équipe, régénération et lien expiré — Drawer sur mobile.

## Quand l'utiliser
- Depuis la topbar d'une session (rétro, poker, whiteboard, icebreaker, sondage) : bouton `user-plus` « Inviter » / « Invite », ou commande ⌘K « Inviter dans la session ».
- Ouvert par le facilitateur ; un participant voit la même dialog en lecture seule (lien + QR + code, sans réglages ni régénération).
- Mobile (`useIsMobile`) → `Drawer` : QR et code en premier, « Copier le lien » + « Partager… » (Web Share API), un seul réglage visible (invités anonymes).
- Pas pour gérer les membres de l'équipe (page Équipe › Members) ni les invitations au workspace.

## Anatomie
En-tête (titre « Inviter à la rétro sprint 42 », équipe · nombre de présents, bouton fermer) · `Tabs` pleine largeur « Lien & QR » / « Membres (12) » · champ lien en lecture seule (`--muted`, police mono, ellipsis) + bouton « Copier » · bloc partage `--muted` : QR (grille 25×25 + logo au centre, **toujours foncé sur clair**) + « Code de session » `ATL-4821` en mono 24/650 + « À saisir sur skrum.atlas.dev/join » + « Télécharger le QR » · séparateur · réglages en lignes libellé/aide ↔ contrôle : rôle (`Select` Participant / Observateur / Facilitateur avec description), invités anonymes (`Switch`), expiration (`Select` : 1 h, 24 h, 7 jours, fin de session, jamais) · pied : « Régénérer le lien » (ghost) ↔ « Terminé ».
Onglet Membres : combobox multi-sélection (chips avatar + nom, saisie filtrée, liste avec avatar, nom, e-mail, badge « Déjà dans la session » désactivé) · aide · rôle + « Envoyer N invitations ».

## Props
```ts
type SessionRole = 'participant' | 'observer' | 'facilitator';
type LinkExpiry = '1h' | '24h' | '7d' | 'session_end' | 'never';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: { id: string; kind: 'retro' | 'poker' | 'whiteboard' | 'icebreaker' | 'survey'; title: string; teamName: string; presentCount: number };
  invite: {
    url: string;                      // https://skrum.atlas.dev/j/ATL-4821-k7Qp
    code: string;                     // ATL-4821 (3 lettres d'équipe + 4 chiffres)
    joinUrl: string;                  // skrum.atlas.dev/join
    defaultRole: SessionRole;
    allowGuests: boolean;
    expiry: LinkExpiry;
    expiresAt: string | null;         // ISO
    status: 'active' | 'expired';
  };
  canManage: boolean;                 // facilitateur : réglages + régénération
  members: { id: string; name: string; email: string; presence: number /* 1..12 */; avatarUrl?: string; inSession: boolean }[];
  tab?: 'link' | 'members';
  isMobile?: boolean;                 // Drawer
  onCopy: (what: 'url' | 'code') => void;          // + toast « Lien copié »
  onDownloadQr: () => void;                        // PNG 1024 px, quiet zone 4 modules
  onChange: (patch: Partial<Pick<ShareDialogProps['invite'], 'defaultRole' | 'allowGuests' | 'expiry'>>) => void;
  onRegenerate: () => Promise<void>;               // après confirmation
  onInvite: (memberIds: string[], role: SessionRole) => Promise<void>;
  onShare?: () => void;                            // navigator.share (mobile)
}
```

## États
- **Lien actif** (défaut, onglet Lien & QR).
- **Copié** : le bouton passe 2 s en « Copié » (`check`, `--skrum-success-soft` / `--skrum-success-text`) + toast Sonner succès « Lien copié » avec rôle et échéance.
- **Sélecteur de rôle ouvert** : 3 options avec icône (`user`, `eye`, `wand-sparkles`) et description en une ligne, coche sur la valeur.
- **Membres** : combobox ouverte, correspondance soulignée en gras, option active `--accent`, membre déjà présent désactivé ; bouton « Envoyer 2 invitations » (compte dynamique, désactivé à 0).
- **Régénérer** : `AlertDialog` destructive (focus initial sur « Annuler ») — l'ancien lien, le QR et le code cessent de fonctionner, les présents restent connectés.
- **Lien expiré** : alerte warning datée, champ barré désactivé, QR estompé avec badge « Expiré », copie et téléchargement désactivés, action principale « Générer un nouveau lien ».
- **Invités désactivés** : le switch off ajoute l'aide « Connexion obligatoire (SSO si configuré) ».
- **Lecture seule** (participant) : réglages masqués, pas de pied.
- **Drawer mobile**.

## Accessibilité & clavier
- `role="dialog"` + `aria-modal` + `aria-labelledby` (titre) ; `Esc` ferme, focus rendu au bouton « Inviter ».
- Focus initial sur « Copier » ; `⌘C` / `Ctrl C` quand le champ lien a le focus copie l'URL entière (le champ est `readonly`, sélection complète au focus).
- Confirmation de copie annoncée par le toast (`role="status"`) et le libellé « Copié » (`aria-live="polite"`).
- QR : `role="img"` + `aria-label` « QR code pour rejoindre … » ; le code court est l'alternative textuelle (lisible à voix haute, sans 0/O ni 1/I).
- Tabs : `←/→` ; combobox : `↑/↓` options, `Entrée` ajoute, `Retour arrière` retire le dernier chip, `aria-activedescendant`, options désactivées `aria-disabled`.
- Switch : `role="switch"` + `aria-checked`, libellé = texte de la ligne.

## Temps réel
- `InviteLinkRegenerated {code, url}` et `InviteSettingsUpdated` diffusés aux co-facilitateurs (`presence-session.{id}`) : la dialog ouverte se met à jour sans se fermer.
- À l'expiration (`expiresAt` atteint pendant l'ouverture), bascule automatique vers l'état « Lien expiré ».
- Les membres qui rejoignent passent en « Déjà dans la session » dans la combobox (`.joining`).

## À faire / À éviter
- Faire : afficher le code court en plus du lien (oral, visio, salle) ; dater l'expiration en clair.
- Faire : garder le QR foncé sur clair dans les deux thèmes (lecture caméra) avec une marge de 2 modules minimum.
- Éviter : régénérer sans confirmation ; mettre le lien dans un `<input>` éditable ; un QR coloré ou inversé en mode sombre.

## Tokens
`--popover` `--popover-foreground` `--card` `--foreground` `--background` `--muted` `--muted-foreground` `--border` `--input` `--accent` `--primary` `--primary-foreground` `--secondary` `--secondary-foreground` `--ring` `--skrum-success-soft` `--skrum-success-text` `--skrum-warning-soft` `--skrum-warning-text` `--skrum-destructive-soft` `--skrum-destructive-text` `--destructive` `--skrum-scrim` `--skrum-presence-*` `--font-mono` `--radius` `--radius-md` `--radius-xl` `--radius-2xl` `--shadow-modal` `--shadow-popover` `--space-1` … `--space-8`

## Mapping shadcn
- `@/components/ui/dialog` (desktop) / `@/components/ui/drawer` (mobile), `tabs`, `input` (readOnly), `button`, `select`, `switch`, `separator`, `alert-dialog` (régénérer), `alert`, `popover` + `command` (combobox membres), `avatar`, `badge`, `sonner` (toast).
- DialogContent : `max-w-128 gap-4 rounded-xl bg-popover p-6 shadow-modal` ; overlay `bg-skrum-scrim backdrop-blur-xs`. Description : `text-body-sm text-muted-foreground`.
- Tabs : `TabsList className="w-full"`, `TabsTrigger className="flex-1 min-w-0 truncate"` ; compteur `rounded-full bg-foreground/8 px-1.5 text-overline text-muted-foreground`.
- Lien : `flex gap-2` → `Input readOnly className="min-w-0 flex-1 bg-muted font-mono text-body-sm truncate"` + `Button variant="outline"` ; état copié `bg-skrum-success-soft text-skrum-success-text border-skrum-success-text/35`.
- Bloc partage : `flex flex-wrap items-center gap-4 rounded-lg bg-muted p-3`. QR : `w-30 shrink-0 rounded-md ring-1 ring-border` avec `fill-foreground` sur `bg-card`, et `dark:bg-foreground dark:fill-background` (toujours foncé sur clair). Code : `font-mono text-2xl font-semibold tracking-wider`.
- Ligne de réglage : `flex flex-wrap items-center justify-between gap-x-4 gap-y-2` ; libellé `min-w-0 flex-1 basis-40` (`text-sm font-semibold` + `text-xs text-muted-foreground`) ; `SelectTrigger className="w-44"`.
- Options de rôle : `SelectItem className="items-start py-1.5"` + description `text-xs text-muted-foreground truncate`.
- Combobox : déclencheur `min-h-10 flex flex-wrap gap-1 px-2 py-1` ; chip `h-6.5 rounded-full bg-secondary text-secondary-foreground text-body-sm font-semibold` ; `CommandItem className="gap-2 py-1.5 data-[selected=true]:bg-accent data-[disabled=true]:opacity-55"`.
- Expiré : `Alert` warning `bg-skrum-warning-soft text-skrum-warning-text text-body-sm` ; QR `opacity-20 grayscale` + `Badge` warning centré.
- Drawer : `DrawerContent className="rounded-t-2xl px-5 pb-6"`, actions `grid grid-cols-2 gap-2`.
