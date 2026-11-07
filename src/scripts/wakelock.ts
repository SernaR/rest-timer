/**
 * Empêche l'écran de s'éteindre pendant un repos (Wake Lock API).
 * Le navigateur libère le verrou dès que la page est masquée : il est
 * redemandé quand elle redevient visible. Absence d'API ou refus : ignorés.
 */

let wanted = false;
let sentinel: WakeLockSentinel | null = null;
let pending: Promise<void> | null = null;

async function request(): Promise<void> {
	try {
		const lock = await navigator.wakeLock.request('screen');
		if (!wanted) {
			// Libéré entre-temps (repos annulé pendant la demande).
			await lock.release();
			return;
		}
		sentinel = lock;
		lock.addEventListener('release', () => {
			if (sentinel === lock) sentinel = null;
		});
	} catch {
		// Non autorisé (page masquée, économie d'énergie…) : on fait sans.
	}
}

function ensure(): void {
	if (!wanted || sentinel || pending) return;
	if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
	pending = request().finally(() => {
		pending = null;
	});
}

export function acquire(): void {
	wanted = true;
	ensure();
}

export function release(): void {
	wanted = false;
	const lock = sentinel;
	sentinel = null;
	void lock?.release().catch(() => {});
}

document.addEventListener('visibilitychange', ensure);
