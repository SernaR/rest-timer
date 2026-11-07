// @ts-nocheck -- contexte service worker : les types DOM du projet ne s'appliquent pas.
/**
 * Service worker : l'app fonctionne hors ligne après la première visite.
 * Stratégie cache-first. La version est injectée au build (voir
 * src/pages/sw.js.ts) : chaque déploiement installe un nouveau cache et
 * supprime l'ancien.
 */

const VERSION = '__VERSION__';
const PREFIX = 'rest-timer-';
const CACHE = PREFIX + VERSION;

// Dossier de l'app, déduit de l'emplacement du service worker
// ('/rest-timer/' sur GitHub Pages, '/' ailleurs).
const BASE = new URL('./', self.location.href).pathname;

const STATIC_FILES = [
	'manifest.webmanifest',
	'icons/icon.svg',
	'icons/icon-192.png',
	'icons/icon-512.png',
	'icons/icon-maskable-512.png',
	'icons/apple-touch-icon.png',
].map((path) => BASE + path);

/** Fichiers `/_astro/…` (JS, CSS hachés) référencés par la page. */
function astroAssets(html) {
	const urls = new Set();
	for (const match of html.matchAll(/(?:src|href)="([^"]*\/_astro\/[^"]+)"/g)) {
		urls.add(new URL(match[1], self.location.href).pathname);
	}
	return [...urls];
}

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			const page = await fetch(BASE, { cache: 'reload' });
			if (!page.ok) throw new Error(`Page indisponible (${page.status})`);
			const html = await page.clone().text();
			await cache.put(BASE, page);
			await cache.addAll(
				[...STATIC_FILES, ...astroAssets(html)].map(
					(url) => new Request(url, { cache: 'reload' }),
				),
			);
			// Nouvelle version active tout de suite : elle servira l'ouverture suivante.
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const name of await caches.keys()) {
				if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
			}
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			// Navigation : toujours la page de l'app (une seule page).
			const key = request.mode === 'navigate' ? BASE : request;
			const cached = await cache.match(key, { ignoreSearch: true });
			if (cached) return cached;

			const response = await fetch(request);
			if (response.ok && url.pathname.startsWith(BASE + '_astro/')) {
				await cache.put(request, response.clone());
			}
			return response;
		})(),
	);
});
