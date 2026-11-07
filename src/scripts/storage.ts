/**
 * Sauvegarde du repos en cours, pour le reprendre si le système recharge la
 * page (fréquent sur iOS quand l'app passe en arrière-plan).
 */

const STORAGE_KEY = 'rest-timer:rest';

export interface SavedRest {
	endTime: number;
	/** Durée totale, en secondes. */
	duration: number;
}

export function saveRest(rest: SavedRest): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
	} catch {
		// Navigation privée : pas de reprise possible, l'app fonctionne quand même.
	}
}

export function loadRest(): SavedRest | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const { endTime, duration } = JSON.parse(raw) as Partial<SavedRest>;
		if (typeof endTime !== 'number' || typeof duration !== 'number' || duration <= 0) {
			return null;
		}
		return { endTime, duration };
	} catch {
		return null;
	}
}

export function clearRest(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Rien à faire.
	}
}
