# La Grinta 🎲

Le jeu de plateau immobilier du serveur LaGrinta, en 3D, à jouer en ligne entre potes.

- Plateau 3D (Three.js) avec les cases aux noms des membres et des salons du serveur
- 8 persos animés faits en code (Le Boss, La Rappeuse, Le Chef, L'Astronaute, Le Ninja, Le Robot, La Reine, Le Footeux)
- Multijoueur jusqu'à 8 : tu crées une partie, tu envoies le lien, tes potes rejoignent
- Achat, loyers, maisons et hôtels, hypothèques, échanges entre joueurs, cartes « Ping @everyone » et « Grinta Corp », Timeout, cagnotte AFK

## Jouer en local

```bash
npm install
npm run dev
```

## Déployer sur Vercel

1. Importer ce repo sur https://vercel.com/new
2. Vercel détecte Vite tout seul (build `npm run build`, dossier `dist`). Clique sur **Deploy**.
3. Partage l'URL à tes potes.

Aucun compte en plus n'est nécessaire : le multijoueur passe en pair-à-pair (WebRTC) via le serveur public gratuit de PeerJS.
Le navigateur de la personne qui crée la partie fait office d'hôte : s'il ferme l'onglet, la partie est en pause, et elle reprend quand il revient sur le même lien (l'état est sauvegardé dans son navigateur).

### Option : ton propre serveur PeerJS

Si le serveur public est saturé, tu peux héberger le tien (ex. `npx peerjs --port 9000`) et renseigner ces variables dans Vercel :

| Variable | Exemple |
| --- | --- |
| `VITE_PEER_HOST` | `peer.mondomaine.com` |
| `VITE_PEER_PORT` | `443` |
| `VITE_PEER_PATH` | `/` |
| `VITE_PEER_SECURE` | `true` |

## Fichiers utiles

- `src/game/board.js` : cases, prix, cartes, persos
- `src/game/engine.js` : règles du jeu (exécutées par l'hôte)
- `src/net/room.js` : multijoueur PeerJS
- `src/three/` : scène 3D, plateau, persos animés
- `showcase.html` : vitrine des persos (`npm run dev` puis `/showcase.html`)
