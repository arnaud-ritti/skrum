Écran d'authentification (desktop 1440) : connexion en split écran + variantes inscription et « lien magique envoyé ».

**But** — se connecter vite par SSO d'entreprise, OAuth ou e-mail ; le lien magique évite le mot de passe.

**Zones**
- Gauche : logo, titre, « Continuer avec SSO (OIDC) » (bouton outline lg, en premier car prioritaire en self-host), Google / GitHub, séparateur « ou avec ton e-mail », champs e-mail (focus) + mot de passe (afficher/masquer, « oublié ? »), Checkbox « Rester connecté », bouton primaire, bouton ghost « Recevoir un lien magique », lien vers l'inscription, pied avec nom d'instance + version.
- Droite : panneau de marque sobre sur `--secondary` (sauge) avec dotgrid, promesse en display-xl, 2 RetroCard + 1 ActionItem légèrement tournés — pas de photo.
- Variantes (sous le cadre) : Inscription (nom, équipe, e-mail en erreur avec `sk-error-msg`, mot de passe) ; Lien magique envoyé (icône mail-check, adresse en gras, « Renvoyer dans 0:42 » désactivé, alerte info SMTP self-host).

**Composants** — Button (outline/ghost/lg/block), Input, Field, Checkbox, Alert, Card, sk-rcard, sk-action.

**Comportement** — un admin self-host peut masquer Google/GitHub ou forcer le SSO seul (le formulaire e-mail disparaît). Les erreurs restent sous le champ, jamais en toast.

**Mobile** — panneau de marque masqué ; formulaire pleine largeur (padding 16), boutons SSO empilés, champs en 1 colonne.
