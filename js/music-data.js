const SONG_DIR = 'images/spotify_widget/songs/';
const ALBUM_DIR = 'images/spotify_widget/albums/';
const ARTIST_DIR = 'images/spotify_widget/artists/';
const SPOTIFY = 'https://open.spotify.com/';

// Newest release first; the rotation plays them in this order. Titles, credits,
// dates and lengths are Spotify's, so take new entries from the track's page
// rather than from memory. `date` drives the sort, `sec` the length column.
export const songs = [
  { title: "WannaCry", artist: "Ninajirachi, Porter Robinson", album: "WannaCry", date: "2026-07-28", sec: 219, cover: SONG_DIR + "wannacry.jpg", url: SPOTIFY + "track/7JW8FRWVCOQDs40IjEXdPi" },
  { title: "Rebirth", artist: "Forza Horizon, SHIMA", album: "Forza Horizon 6 (Original Soundtrack)", date: "2026-05-29", sec: 205, cover: SONG_DIR + "rebirth.jpeg", url: SPOTIFY + "track/2LUkkxYU5xhKpt4kU2o3XL" },
  { title: "Slide", artist: "MRJay", album: "Slide", date: "2026-02-14", sec: 230, cover: SONG_DIR + "slide.jpeg", url: SPOTIFY + "track/0ovb94vsCrDhyWeDhmM8lZ" },
  { title: "Heaven", artist: "Alison Wonderland, Ninajirachi", album: "GHOST WORLD", date: "2025-12-05", sec: 206, cover: SONG_DIR + "heaven.webp", url: SPOTIFY + "track/7Ei2LsA34MJPITPv72dvZw" },
  { title: "Ghostlight", artist: "Skeler, Veela", album: "H a r d W a v e 夜勤 - Part II", date: "2025-11-21", sec: 149, cover: SONG_DIR + "Ghostlight.jpeg", url: SPOTIFY + "track/3cIwpwN14IdkqEQe8YYCb8" },
  { title: "Elevate", artist: "Sub Focus", album: "Contact", date: "2025-11-21", sec: 193, cover: SONG_DIR + "elevate.jpeg", url: SPOTIFY + "track/7jIIaLkLcxyn9z2GvQi1Se" },
  { title: "Evergreen Misery", artist: "MOTHICA", album: "Evergreen Misery", date: "2025-11-11", sec: 198, cover: SONG_DIR + "mothica.jpeg", url: SPOTIFY + "track/1ypA3UK8yindQars9vhhWx" },
  { title: "Infohazard", artist: "Ninajirachi", album: "I Love My Computer", date: "2025-08-08", sec: 269, cover: ALBUM_DIR + "i_love_my_computer.webp", url: SPOTIFY + "track/6CfromGdojo0R0vlgA7iU8" },
  { title: "Battery Death", artist: "Ninajirachi", album: "I Love My Computer", date: "2025-08-08", sec: 198, cover: ALBUM_DIR + "i_love_my_computer.webp", url: SPOTIFY + "track/2XGJUQGZQXr5pHH11AL9oG" },
  { title: "Darling Game Over Love", artist: "MAIKI P", album: "Darling Game Over Love", date: "2025-06-28", sec: 152, cover: SONG_DIR + "maikip.jpg", url: SPOTIFY + "track/4zxaJEVtaWVdMp6m4juvpr" },
  { title: "Affection Addiction", artist: "VocaloKAT, Aku P", album: "Affection Addiction", date: "2025-04-05", sec: 220, cover: SONG_DIR + "affection.jpeg", url: SPOTIFY + "track/68RUQHVnQZa8dvw1K8Cxk3" },
  { title: "one last thing", artist: "vinter", album: "one last thing", date: "2024-02-23", sec: 124, cover: SONG_DIR + "vinter.jpg", url: SPOTIFY + "track/1phEAAEhbt5hnHByoq2mqH" },
  { title: "FORTUNE", artist: "SAKUREYE", album: "FORTUNE", date: "2021-09-10", sec: 195, cover: SONG_DIR + "fortune.jpg", url: SPOTIFY + "track/3oSe6mGxChrwC6SDeZDbgo" },
  { title: "Delicate Weapon", artist: "Grimes, Lizzy Wizzy", album: "Cyberpunk 2077: Radio, Vol. 2 (Original Soundtrack)", date: "2020-12-18", sec: 230, cover: SONG_DIR + "delicate_weapon.jpg", url: SPOTIFY + "track/1hT3eaGzrcFriQtgGdvsZv" },
  { title: "THE BADDEST", artist: "K/DA", album: "ALL OUT", date: "2020-08-27", sec: 163, cover: SONG_DIR + "the_baddest.jpg", url: SPOTIFY + "track/6y3EPT8iw6HmuMpX05gyvt" },
  { title: "Flesh without Blood", artist: "Grimes", album: "Art Angels", date: "2015-11-06", sec: 265, cover: ALBUM_DIR + "artangels.webp", url: SPOTIFY + "track/62jc4VA6WPoANaL9Duu8db" }
];

// fav albums + artists — `note` is the year on the album tiles.
// genre lines are the descriptions the artists/their labels use; see the
// sources noted in the commit rather than guessing new ones.
export const albums = [
  { title: "I Love My Computer", artist: "Ninajirachi", note: "2025", cover: ALBUM_DIR + "i_love_my_computer.webp", url: SPOTIFY + "album/77CZUF57sYqgtznUe3OikQ" },
  { title: "Escape Cycle", artist: "Darci", note: "2023", cover: ALBUM_DIR + "escapecycle.jpeg", url: SPOTIFY + "album/2JCIdveMkl6k4YdAqEMEBx" },
  { title: "Call For Help", artist: "Pearly Drops", note: "2020", cover: ALBUM_DIR + "callforhelp.jpeg", url: SPOTIFY + "album/2T0LDUVshmydIaKywFCDKX" },
  { title: "Miss Anthropocene", artist: "Grimes", note: "2020", cover: ALBUM_DIR + "miss_anthropocene.jpeg", url: SPOTIFY + "album/2tKMfEo15Y4OMEm5sljPsJ" },
  { title: "Art Angels", artist: "Grimes", note: "2015", cover: ALBUM_DIR + "artangels.webp", url: SPOTIFY + "album/7J84ixPVFehy6FcLk8rhk3" },
  { title: "Hysteria", artist: "Def Leppard", note: "1987", cover: ALBUM_DIR + "hysteria.jpeg", url: SPOTIFY + "album/1ja2qzCrh6bZykcojbZs82" }
];

export const artists = [
  { title: "Ninajirachi", artist: "girl edm · electro house", cover: ARTIST_DIR + "ninajirachi.jpeg", url: SPOTIFY + "artist/3MekbRujJg5VZThubOlrkR" },
  { title: "Grimes", artist: "art pop · synth-pop", cover: ARTIST_DIR + "grimes.jpeg", url: SPOTIFY + "artist/053q0ukIDRgzwTr4vNSwab" },
  { title: "REZZ", artist: "midtempo bass", cover: ARTIST_DIR + "rezz.jpeg", url: SPOTIFY + "artist/4aKdmOXdUKX07HVd3sGgzw" },
  { title: "Skeler", artist: "hardwave · wave", cover: ARTIST_DIR + "skeler.jpeg", url: SPOTIFY + "artist/7ks4LdnBvp6HUsmVJiKgsB" },
  { title: "Reol", artist: "j-pop · electropop", cover: ARTIST_DIR + "reol.jpeg", url: SPOTIFY + "artist/7rpKUJ0AnklJ8q9nIPVSpZ" },
  { title: "Exyl", artist: "electro house · glitch hop", cover: ARTIST_DIR + "exyl.jpeg", url: SPOTIFY + "artist/5eYIGMKb2BdsIXbScrOPK2" },
  { title: "TheFatRat", artist: "glitch hop", cover: ARTIST_DIR + "thefatrat.jpeg", url: SPOTIFY + "artist/3OKg7YbOIatODzkRIbLJR4" },
  { title: "Darci", artist: "wave · trap soul", cover: ARTIST_DIR + "darci.jpeg", url: SPOTIFY + "artist/1lAvOODEAbUI5b51WRBbdx" }
];
