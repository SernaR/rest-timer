import type { APIRoute } from 'astro';
import source from '../service-worker/sw.js?raw';

// Généré une fois au build : chaque déploiement donne un service worker
// différent, donc une mise à jour du cache sur la tablette.
const version = new Date().toISOString().replace(/\D/g, '').slice(0, 14);

export const GET: APIRoute = () =>
	new Response(source.replace("'__VERSION__'", `'${version}'`), {
		headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
	});
