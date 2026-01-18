import { defaultPlaylists } from '$lib/config/playlists';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		defaultPlaylists
	};
};
