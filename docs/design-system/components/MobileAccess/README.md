Maquettes mobiles 390×844 des écrans d'entrée : landing, connexion et arrivée d'un invité.

**But** — amener un participant dans un rituel en moins de 10 secondes, et un membre dans son espace sans mot de passe.

**Zones**
- *Landing* : barre logo + « Se connecter », hero (promesse, 2 CTA `sk-btn--lg` pleine largeur), mini-board de 2 `sk-rcard`, liste des modules (`m-ico` teintée `sk-c-*`).
- *Connexion* : SSO d'instance en premier (`sk-btn--outline`), séparateur, segmented control Lien magique / Mot de passe, champ e-mail 48 px (16 px de police : pas de zoom iOS), confirmation `sk-alert--success`.
- *Invité* : carte d'invitation (facilitateur, statut `sk-badge--success`), aperçu d'avatar XL, pseudo, grille 6×2 des 12 couleurs de présence (48 px, couleurs prises marquées), CTA collé en bas.

**Choix mobiles**
- CTA principal toujours en bas, dans la zone du pouce, `sk-btn--lg` (44 px).
- Pas de compte exigé pour l'invité ; la couleur prise par un autre reste visible mais marquée (icône `user`) plutôt que masquée.
- Champs à 16 px pour éviter le zoom automatique de Safari.

**Composants** : Button, Input, Badge, Avatar, PresenceStack, Alert, RetroCard, VoteDots, GuestJoin.
