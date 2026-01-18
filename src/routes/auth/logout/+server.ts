import { redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { deleteSessionTokenCookie, invalidateSession } from '$lib/server/auth';

export async function POST(event: RequestEvent) {
	const { locals } = event;
	if (locals.session) {
		await invalidateSession(locals.session.id);
		deleteSessionTokenCookie(event);
	}
	redirect(302, '/auth/login');
}
