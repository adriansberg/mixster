import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

// Spotify's album.release_date is often the compilation/remaster date, not the
// song's original release. Claude + web search looks up the original year.

const MODEL = 'claude-opus-5';
const REPORT_TOOL = 'report_release_year';

export interface ReleaseYearQuery {
	trackId: string;
	name: string;
	artists: string[];
	album?: string;
	spotifyYear: number;
}

export interface ReleaseYearResult {
	year: number;
	confidence: 'high' | 'medium' | 'low';
	note: string;
}

export class AiNotConfiguredError extends Error {}

let client: Anthropic | null = null;

function getClient(): Anthropic {
	if (!env.ANTHROPIC_API_KEY) {
		throw new AiNotConfiguredError('ANTHROPIC_API_KEY is not set');
	}
	client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
	return client;
}

// Per-instance cache: the same track gets checked repeatedly across parties.
const cache = new Map<string, ReleaseYearResult>();

const SYSTEM_PROMPT = `You verify the ORIGINAL release year of songs for a music-timeline party game (like Hitster).

Spotify metadata often reports the year of a compilation, "greatest hits" album, remaster, deluxe edition or re-release instead of when the song first came out. Players place songs on a timeline by year, so the year the recording was first released (as a single or on its original album) is what matters.

Rules:
- Use web search when you are not certain. Prefer sources like Wikipedia, Discogs and MusicBrainz.
- If the track is a live version, re-recording or remix that is distinct from the original, still report the year the song was first released, and mention the version difference in the note.
- If Spotify's year is already correct, report that same year.
- Finish by calling the ${REPORT_TOOL} tool exactly once. The note must be one short sentence in Norwegian (bokmål) explaining the source of the year, e.g. "Opprinnelig singel fra 1983; Spotify viser samlealbumet fra 2004."`;

const reportTool: Anthropic.Beta.BetaTool = {
	name: REPORT_TOOL,
	description: 'Report the original release year of the song. Call this once, as the final step.',
	strict: true,
	input_schema: {
		type: 'object',
		properties: {
			year: { type: 'integer', description: 'Original release year of the song' },
			confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
			note: { type: 'string', description: 'One short sentence in Norwegian (bokmål)' }
		},
		required: ['year', 'confidence', 'note'],
		additionalProperties: false
	}
};

export async function verifyReleaseYear(query: ReleaseYearQuery): Promise<ReleaseYearResult | null> {
	const cached = cache.get(query.trackId);
	if (cached) return cached;

	const anthropic = getClient();

	const messages: Anthropic.Beta.BetaMessageParam[] = [
		{
			role: 'user',
			content: [
				`Song: ${query.name}`,
				`Artist(s): ${query.artists.join(', ')}`,
				query.album ? `Spotify album: ${query.album}` : null,
				`Spotify release year: ${query.spotifyYear}`,
				'',
				'What year was this song originally released?'
			]
				.filter((line) => line !== null)
				.join('\n')
		}
	];

	// Server-side web search may pause a long turn; resume a couple of times.
	for (let turn = 0; turn < 3; turn++) {
		const response = await anthropic.beta.messages.create({
			model: MODEL,
			max_tokens: 8000,
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			output_config: { effort: 'low' },
			system: SYSTEM_PROMPT,
			tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }, reportTool],
			messages
		});

		if (response.stop_reason === 'refusal') return null;

		const report = response.content.find(
			(block): block is Anthropic.Beta.BetaToolUseBlock =>
				block.type === 'tool_use' && block.name === REPORT_TOOL
		);
		if (report) {
			const result = parseReport(report.input);
			if (result) cache.set(query.trackId, result);
			return result;
		}

		if (response.stop_reason !== 'pause_turn') return null;
		messages.push({ role: 'assistant', content: response.content });
	}

	return null;
}

function parseReport(input: unknown): ReleaseYearResult | null {
	const { year, confidence, note } = (input ?? {}) as Record<string, unknown>;
	const currentYear = new Date().getFullYear();
	if (typeof year !== 'number' || !Number.isInteger(year) || year < 1800 || year > currentYear) {
		return null;
	}
	if (confidence !== 'high' && confidence !== 'medium' && confidence !== 'low') return null;
	return { year, confidence, note: typeof note === 'string' ? note : '' };
}
