La sidebar unique de Skrüm : centrée sur l'équipe, avec l'espace de travail rangé dans le sélecteur d'équipe.

## Modèle (un seul, partout)

1. **Marque** : symbole + `skrüm`, ou logo de l'instance en white-label.
2. **Sélecteur d'équipe** (`sk-team-switch`) : pastille de l'équipe, nom, puis `Espace · n membres`. Il ouvre un menu qui liste les équipes de l'espace courant, les autres espaces, « Nouvelle équipe » et « Nouvel espace de travail ». C'est le seul endroit où l'on change d'espace de travail.
3. **Équipe** (groupe) : Tableau de bord (`LayoutDashboard`), Sessions (`CalendarClock` : rétros, poker, whiteboards, sondages, icebreakers), Actions (`ListChecks`, badge `destructive` « n en retard »), Moral & ROTI (`TrendingUp`, health check inclus), Jeux (`PartyPopper`), Membres (`Users`).
4. **Espace de travail** (groupe) : Modèles (`LayoutTemplate`), Toutes les équipes (`Building2`).
5. **Pied** : Paramètres de l'équipe (`Settings`), Administration (`ShieldCheck`, admins d'instance uniquement), puis la carte utilisateur (`sk-user` : avatar, nom, rôle). Son menu contient Paramètres du compte, Apparence et Déconnexion.

EN : Team, Dashboard, Sessions, Actions, Mood & ROTI, Games, Members · Workspace, Templates, All teams · Team settings, Administration.

## Variantes

- **Déployée** (`w-64`) : partout hors session.
- **Repliée en icônes** (`w-12`, `.is-collapsed`) : pendant une rétro, un poker, un whiteboard ou un icebreaker. Mêmes entrées, même ordre ; le badge d'Actions devient une pastille, et un tooltip affiche le libellé avec son raccourci.
- **Mobile** : barre d'onglets en bas (Accueil, Sessions, Actions, Moral, Plus). « Plus » ouvre un Drawer avec le reste du modèle.
- **Pas de seconde sidebar.** Les sections de paramètres (compte, équipe, admin d'instance) passent par une sous-navigation dans la page (`.sk-subnav`), à droite de la sidebar.

## Props

```ts
type NavKey = 'dashboard' | 'sessions' | 'actions' | 'mood' | 'games' | 'members' | 'templates' | 'teams' | 'settings' | 'admin';
interface AppSidebarProps {
  active?: NavKey;
  collapsed?: boolean;              // true dans les écrans de session
  team: { id: string; name: string; initials: string; membersCount: number };
  workspace: { id: string; name: string };
  overdueActions?: number;          // badge Actions
  canAdministrate?: boolean;        // affiche « Administration »
  user: { name: string; role: string; initials: string; presence: 1|2|3|4|5|6|7|8|9|10|11|12 };
}
```

## Accessibilité & clavier

- Rendu en `<nav aria-label="Navigation">`. L'entrée active porte `aria-current="page"`.
- `⌘B` replie ou déplie la sidebar. Le sélecteur s'ouvre avec Entrée ou Espace et se parcourt aux flèches.
- Repliée : chaque lien a un `aria-label` et un tooltip.

## Mapping shadcn

`@/components/ui/sidebar` : `SidebarProvider` (`--sidebar-width: 16rem`, `--sidebar-width-icon: 3rem`), `Sidebar collapsible="icon"`, `SidebarHeader` (marque + `DropdownMenu` du sélecteur d'équipe), `SidebarGroup` / `SidebarGroupLabel` pour Équipe et Espace de travail, `SidebarMenuButton isActive`, `SidebarMenuBadge` pour le retard, `SidebarFooter` (paramètres, admin, `NavUser`). Classes : `bg-sidebar text-sidebar-foreground border-sidebar-border`, actif `bg-sidebar-accent text-sidebar-accent-foreground font-semibold`, icône active `text-skrum-primary-text`.

## Tokens

`sidebar`, `sidebar-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-primary` (pastille d'équipe), `sidebar-ring`, `skrum-primary-text`, `destructive` (pastille repliée), `sidebar-width`, `sidebar-width-icon`.
