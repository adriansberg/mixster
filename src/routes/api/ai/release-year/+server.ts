import { json, type RequestHandler } from '@sveltejs/kit';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { AiNotConfiguredError, verifyReleaseYear } from '$lib/server/ai';

const bodySchema = z.object({
	trackId: z.string().min(1).max(64),
	name: z.string().min(1).max(300),
	artists: z.array(z.string().max(200)).min(1).max(10),
	album: z.string().max(300).optional(),
	spotifyYear: z.number().int()
});

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ error: 'Invalid request' }, { status: 400 });
	}

	try {
		const result = await verifyReleaseYear(parsed.data);
		if (!result) {
			return json({ error: 'AI fant ikke et sikkert årstall.' }, { status: 502 });
		}
		return json(result);
	} catch (error) {
		if (error instanceof AiNotConfiguredError) {
			return json({ error: 'AI-sjekk er ikke konfigurert.' }, { status: 503 });
		}
		if (error instanceof Anthropic.RateLimitError) {
			return json({ error: 'AI er opptatt. Prøv igjen om litt.' }, { status: 429 });
		}
		console.error('Error verifying release year:', error);
		return json({ error: 'AI-sjekk feilet.' }, { status: 500 });
	}
};
