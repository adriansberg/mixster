export interface DefaultPlaylist {
	id: string;
	name: string;
	spotifyUri: string;
	description: string;
}

export const defaultPlaylists: DefaultPlaylist[] = [
	{
		id: 'norway',
		name: 'HITSTER - Norway',
		spotifyUri: 'spotify:playlist:0aPlDZsvBsCBBvrWym09Lf',
		description: 'HITSTER - Norway'
	},
	{
		id: 'nordics-rock',
		name: 'HITSTER - Nordics Rock',
		spotifyUri: 'spotify:playlist:12WZQyglCMIJ6qWVuqvr7L',
		description: 'HITSTER - Nordics Rock'
	},
	{
		id: 'sweden',
		name: 'HITSTER - Sweden',
		spotifyUri: 'spotify:playlist:6AkPSXrefOXADb7onndgvp',
		description: 'HITSTER - Sweden'
	},
	{
		id: 'nordics-soundtracks',
		name: 'HITSTER - Nordics Soundtracks',
		spotifyUri: 'spotify:playlist:4NQaek60nhU8ZT7mDWi59R',
		description: 'HITSTER - Nordics Soundtracks'
	},
	{
		id: 'uk-guilty-pleasures',
		name: 'HITSTER - UK Guilty Pleasures',
		spotifyUri: 'spotify:playlist:3wUKjSzUUyJyy8OXO4AtJ7',
		description: 'HITSTER - UK Guilty Pleasures'
	},
	{
		id: 'platinum',
		name: 'HITSTER - Platinum Edition',
		spotifyUri: 'spotify:playlist:6a0Z098RE1Bwrii6cuLDAE',
		description: 'HITSTER - Platinum Edition'
	}
];
