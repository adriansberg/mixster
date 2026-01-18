export interface DefaultPlaylist {
	id: string;
	name: string;
	spotifyUri: string;
	category: 'decade' | 'genre';
	description: string;
}

export const defaultPlaylists: DefaultPlaylist[] = [
	// Decades
	{
		id: '1950s',
		name: '1950s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DWSV3Tk4GO2fq',
		category: 'decade',
		description: 'Greatest hits from the 1950s'
	},
	{
		id: '1960s',
		name: '1960s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DXaKIA8E7WcJj',
		category: 'decade',
		description: 'Greatest hits from the 1960s'
	},
	{
		id: '1970s',
		name: '1970s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DWTJ7xPn4vNaz',
		category: 'decade',
		description: 'Greatest hits from the 1970s'
	},
	{
		id: '1980s',
		name: '1980s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DX4UtSsGT1Sbe',
		category: 'decade',
		description: 'Greatest hits from the 1980s'
	},
	{
		id: '1990s',
		name: '1990s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DXbTxeAdrVG2l',
		category: 'decade',
		description: 'Greatest hits from the 1990s'
	},
	{
		id: '2000s',
		name: '2000s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DX4o1oenSJRJd',
		category: 'decade',
		description: 'Greatest hits from the 2000s'
	},
	{
		id: '2010s',
		name: '2010s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DX5Ejj0EkURtP',
		category: 'decade',
		description: 'Greatest hits from the 2010s'
	},
	{
		id: '2020s',
		name: '2020s Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DX2M1uN8RhQ0E',
		category: 'decade',
		description: 'Greatest hits from the 2020s'
	},
	// Genres
	{
		id: 'rock',
		name: 'Rock Classics',
		spotifyUri: 'spotify:playlist:37i9dQZF1DWXRqgorJj26U',
		category: 'genre',
		description: 'Timeless rock classics'
	},
	{
		id: 'pop',
		name: 'Pop Hits',
		spotifyUri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
		category: 'genre',
		description: 'All-time pop favorites'
	},
	{
		id: 'hiphop',
		name: 'Hip-Hop Classics',
		spotifyUri: 'spotify:playlist:37i9dQZF1DX48TTZL62Yht',
		category: 'genre',
		description: 'Classic hip-hop tracks'
	}
];
