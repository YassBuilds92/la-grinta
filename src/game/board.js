// Plateau "La Grinta" — inspiré du serveur Discord LaGrinta.

export const GROUPS = {
  brown: { color: '#8d5a3b', name: 'Les Nouveaux', houseCost: 50 },
  sky: { color: '#4fc3f7', name: 'Les Hors-ligne', houseCost: 50 },
  pink: { color: '#ec4899', name: 'Les Gamers', houseCost: 100 },
  orange: { color: '#fb8c00', name: 'Les Salons', houseCost: 100 },
  red: { color: '#e53935', name: 'Les Lions', houseCost: 150 },
  yellow: { color: '#fdd835', name: 'Les Boosters', houseCost: 150 },
  green: { color: '#43a047', name: 'La Grinta Corp', houseCost: 200 },
  navy: { color: '#3949ab', name: 'Les Grintas', houseCost: 200 },
};

const P = (name, group, price, icon) => {
  const base = Math.max(2, Math.round(price / 14));
  const rents = [1, 5, 15, 42, 55, 70].map((m) => base * m);
  return { type: 'prop', name, group, price, rents, icon };
};
const S = (name) => ({ type: 'station', name, price: 200, icon: '🔊' });
const U = (name, icon) => ({ type: 'utility', name, price: 150, icon });

export const TILES = [
  { type: 'go', name: 'DÉPART', icon: '🏁' },
  P('Chez GdKo', 'brown', 60, '🛋️'),
  { type: 'chest', name: 'Grinta Corp', icon: '💼' },
  P('Coin de Gimbass', 'brown', 60, '🎮'),
  { type: 'tax', name: 'Boost Nitro', amount: 200, icon: '🚀' },
  S('Vocal Général'),
  P('Rue leyoxx', 'sky', 100, '🛴'),
  { type: 'chance', name: 'Ping @everyone', icon: '🔔' },
  P('Allée Antoine', 'sky', 100, '🍟'),
  P('Avenue alexigma', 'sky', 120, '🧩'),
  { type: 'jail', name: 'Prison islamique', icon: '🕌' },
  P('Bd alanthakiid', 'pink', 140, '🎧'),
  U('Bot Maki', '🤖'),
  P('Rue de Viego', 'pink', 140, '🗡️'),
  P('Place de la 222', 'pink', 160, '📍'),
  S('Vocal LOL'),
  P('Quartier akram X', 'orange', 180, '🏙️'),
  { type: 'chest', name: 'Grinta Corp', icon: '💼' },
  P('Studio #musique', 'orange', 180, '🎶'),
  P('Salon #general', 'orange', 200, '💬'),
  { type: 'parking', name: 'AFK', icon: '💤' },
  P("Repaire de l'Idée du Mal", 'red', 220, '😈'),
  { type: 'chance', name: 'Ping @everyone', icon: '🔔' },
  P("Allée de l'Égaré", 'red', 220, '🧭'),
  P('Tour du Lion', 'red', 240, '🦁'),
  S('Vocal Privé'),
  P('Planque de marwan', 'yellow', 260, '🕶️'),
  P('Rooftop de Mata', 'yellow', 260, '🌇'),
  U('Jockie Music', '🎵'),
  P('Avenue des Boosts', 'yellow', 280, '💎'),
  { type: 'gotojail', name: 'Sanction voleurs', icon: '🗡️' },
  P('Les Pyramides', 'green', 300, '🔺'),
  P('Tour Mateja', 'green', 300, '🏢'),
  { type: 'chest', name: 'Grinta Corp', icon: '💼' },
  P('QG Grinta-Corp', 'green', 320, '🏛️'),
  S('Vocal GRINTA'),
  { type: 'chance', name: 'Ping @everyone', icon: '🔔' },
  P("Villa d'Ace", 'navy', 350, '♠️'),
  { type: 'tax', name: 'Taxe du Modo', amount: 100, icon: '🛡️' },
  P('Palais de Yassine', 'navy', 400, '👑'),
];

export const OWNABLE = TILES.map((t, i) => (t.price ? i : -1)).filter((i) => i >= 0);
export const groupTiles = (g) => TILES.map((t, i) => (t.group === g ? i : -1)).filter((i) => i >= 0);
export const STATION_RENT = [0, 25, 50, 100, 200];

// Cartes : kind = money | move | moveRel | jail | jailCard | eachPay | eachGet | repairs | nearest
export const CHANCE = [
  { text: 'Ton clip passe dans #musique et fait le buzz. +150 €.', kind: 'money', amount: 150 },
  { text: 'Tu spammes @everyone. Amende du modo : 50 €.', kind: 'money', amount: -50 },
  { text: 'Retour au DÉPART. Encaisse 200 €.', kind: 'move', to: 0 },
  { text: 'Invitation au Palais de Yassine. Vas-y direct.', kind: 'move', to: 39 },
  { text: "Rendez-vous au Repaire de l'Idée du Mal.", kind: 'move', to: 21 },
  { text: 'Rejoins le salon vocal le plus proche. Si il a un proprio, paie-lui le double.', kind: 'nearest', what: 'station' },
  { text: 'Lag de connexion : recule de 3 cases.', kind: 'moveRel', amount: -3 },
  { text: 'Pris la main dans le sac. Direction la Prison islamique !', kind: 'jail' },
  { text: 'Un modo te couvre. Carte « Unmute ».', kind: 'jailCard' },
  { text: 'Tu payes les tacos à tout le serveur : 50 € à chaque joueur.', kind: 'eachPay', amount: 50 },
  { text: 'Maintenance du serveur : 25 € par maison, 100 € par hôtel.', kind: 'repairs', house: 25, hotel: 100 },
  { text: 'Victoire en ranked sur LOL ! +100 €.', kind: 'money', amount: 100 },
  { text: 'Va voir le bot le plus proche (Maki ou Jockie). Paie 10x les dés s\'il a un proprio.', kind: 'nearest', what: 'utility' },
];

export const CHEST = [
  { text: 'Grinta Corp verse les dividendes : +200 €.', kind: 'money', amount: 200 },
  { text: 'Ton abonnement Nitro est renouvelé : paie 100 €.', kind: 'money', amount: -100 },
  { text: 'Tu revends ton skin rare : +50 €.', kind: 'money', amount: 50 },
  { text: "C'est ton anniv sur le serveur ! Chaque joueur te donne 20 €.", kind: 'eachGet', amount: 20 },
  { text: 'Le voyage aux Pyramides était rentable : +100 €.', kind: 'money', amount: 100 },
  { text: 'Retourne au DÉPART et encaisse 200 €.', kind: 'move', to: 0 },
  { text: 'Nouveau casque pour le vocal : paie 50 €.', kind: 'money', amount: -50 },
  { text: 'akram X te rembourse enfin : +25 €.', kind: 'money', amount: 25 },
  { text: 'Carte « Unmute » : sors de prison gratuitement.', kind: 'jailCard' },
  { text: 'Tu as clash un modo. Direct en prison !', kind: 'jail' },
  { text: 'Refonte du serveur : 40 € par maison, 115 € par hôtel.', kind: 'repairs', house: 40, hotel: 115 },
  { text: 'Prime Grinta Corp de fin d\'année : +150 €.', kind: 'money', amount: 150 },
];

// Uniquement les champions de yaskow (voir notes/CHARACTERS.md) : on n'en ajoute aucun autre sans sa demande.
export const CHARACTERS = [
  { id: 'akhi', name: "L'Akhi", color: '#2e9d48' },
  { id: 'cheikh', name: 'Le Cheikh', color: '#f0b93a' },
  { id: 'ronin', name: 'Le Rōnin', color: '#1c9a93' },
  { id: 'fauve', name: 'Le Fauve', color: '#2f7de1' },
];
