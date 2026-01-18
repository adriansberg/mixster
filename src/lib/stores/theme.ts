import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
	const { subscribe, set, update } = writable<Theme>('light');

	return {
		subscribe,
		toggle: () => {
			update((theme) => {
				const newTheme = theme === 'light' ? 'dark' : 'light';
				if (browser) {
					document.documentElement.classList.remove('light', 'dark');
					document.documentElement.classList.add(newTheme);
					localStorage.setItem('theme', newTheme);
				}
				return newTheme;
			});
		},
		set: (theme: Theme) => {
			if (browser) {
				document.documentElement.classList.remove('light', 'dark');
				document.documentElement.classList.add(theme);
				localStorage.setItem('theme', theme);
			}
			set(theme);
		},
		init: () => {
			if (browser) {
				const stored = localStorage.getItem('theme') as Theme | null;
				const prefersDark = window.matchMedia(
					'(prefers-color-scheme: dark)'
				).matches;
				const theme = stored || (prefersDark ? 'dark' : 'light');
				document.documentElement.classList.add(theme);
				set(theme);
			}
		}
	};
}

export const theme = createThemeStore();
