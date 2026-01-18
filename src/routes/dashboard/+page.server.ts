import { type RequestEvent, redirect } from '@sveltejs/kit';

export const load = async ({ locals }: RequestEvent) => {
	if (!locals.user) {
		redirect(302, '/auth/login');
	}

	return {
		user: locals.user
	};
};
