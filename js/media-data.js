const GAME_DIR = 'images/game_images/';
const SHOW_DIR = 'images/show_images/';
const FILM_DIR = 'images/film_images/';

// One tab per shelf, in this order. A shelf without items shows as "soon" and
// fills itself in as soon as it has some: add { title, cover } and nothing else.
// Covers are 2:3 posters, 340x510 for TV shows and films. Those two run newest first.
export const shelves = [
  {
    id: 'games',
    label: 'Games',
    items: [
      { title: 'Elite: Dangerous', cover: GAME_DIR + 'ED.webp' },
      { title: 'Star Citizen', cover: GAME_DIR + 'starcitizen.webp' },
      { title: 'Cyberpunk 2077', cover: GAME_DIR + 'cyberpunk.webp' },
      { title: 'Ghost of Tsushima', cover: GAME_DIR + 'ghost.webp' },
      { title: 'Forza Horizon 6', cover: GAME_DIR + 'forzahorizon6.webp' },
      { title: 'Honkai: Star Rail', cover: GAME_DIR + 'hsr.webp' },
      { title: 'Arknights: Endfield', cover: GAME_DIR + 'endfield.webp' },
      { title: 'FTL: Faster Than Light', cover: GAME_DIR + 'ftl.webp' },
      { title: 'WorldBox', cover: GAME_DIR + 'worldbox.webp' }
    ]
  },
  {
    id: 'shows',
    label: 'TV shows',
    items: [
      { title: 'Frieren', cover: SHOW_DIR + 'frieren.jpg' },
      { title: 'Foundation', cover: SHOW_DIR + 'foundation.jpg' },
      { title: 'Dr. Stone', cover: SHOW_DIR + 'drstone.jpg' },
      { title: 'Darling in the Franxx', cover: SHOW_DIR + 'darlinginthefranxx.jpg' },
      { title: 'Star Trek: Discovery', cover: SHOW_DIR + 'startrekdisco.jpg' },
      { title: 'Death Note', cover: SHOW_DIR + 'deathnote.jpg' },
      { title: 'Neon Genesis Evangelion', cover: SHOW_DIR + 'nge.jpg' },
      { title: 'Star Trek: The Next Generation', cover: SHOW_DIR + 'startrektng.jpg' }
    ]
  },
  {
    id: 'films',
    label: 'Films',
    items: [
      { title: 'Interstellar', cover: FILM_DIR + 'interstellar.jpg' }
    ]
  }
];
