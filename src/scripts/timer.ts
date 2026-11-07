/**
 * Logique pure du minuteur : aucun accès au DOM, à l'audio ni à l'horloge.
 * L'heure courante (`now`, en ms) est toujours passée en paramètre.
 */

/** Seuils d'alerte, en secondes restantes, du plus tôt au plus tard. */
export const THRESHOLDS = [10, 5, 4, 3, 2, 1, 0] as const;
export type Threshold = (typeof THRESHOLDS)[number];

/** Durée d'affichage de l'écran « GO », en ms. */
export const GO_DISPLAY_MS = 3000;

export type State =
	| { readonly kind: 'idle' }
	| {
			readonly kind: 'running';
			readonly endTime: number;
			/** Durée totale, en secondes. */
			readonly duration: number;
			/** Seuils déjà joués. */
			readonly fired: readonly Threshold[];
	  }
	| { readonly kind: 'go'; readonly until: number };

export type Phase = 'normal' | 'warning' | 'final';

/** préavis (10 s), tic (5 → 1 s), reprise (0 s). */
export type Alert = 'warning' | 'tick' | 'go';

export const IDLE: State = { kind: 'idle' };

export function start(duration: number, now: number): State {
	return { kind: 'running', endTime: now + duration * 1000, duration, fired: [] };
}

/** Annule un décompte en cours. Sans effet dans les autres états. */
export function cancel(state: State): State {
	return state.kind === 'running' ? IDLE : state;
}

export function remainingMs(state: State, now: number): number {
	return state.kind === 'running' ? Math.max(0, state.endTime - now) : 0;
}

/** Secondes affichées, arrondies au supérieur : `1` jusqu'à la fin, `0` à l'échéance. */
export function displaySeconds(remaining: number): number {
	return Math.max(0, Math.ceil(remaining / 1000));
}

export function phaseFor(remaining: number): Phase {
	if (remaining <= 5000) return 'final';
	if (remaining <= 10000) return 'warning';
	return 'normal';
}

/** Part de l'anneau encore pleine, de 1 (début) à 0 (échéance). */
export function progress(state: State, now: number): number {
	if (state.kind !== 'running') return 0;
	return Math.min(1, remainingMs(state, now) / (state.duration * 1000));
}

function alertFor(threshold: Threshold): Alert {
	if (threshold === 0) return 'go';
	if (threshold === 10) return 'warning';
	return 'tick';
}

/**
 * Fait avancer l'état à l'instant `now`.
 * Si plusieurs seuils ont été franchis d'un coup (frame sautée, retour
 * d'arrière-plan), seul le dernier produit une alerte ; les autres sont
 * marqués joués pour éviter une rafale.
 */
export function tick(state: State, now: number): { state: State; alert: Alert | null } {
	if (state.kind === 'go') {
		return { state: now >= state.until ? IDLE : state, alert: null };
	}
	if (state.kind !== 'running') {
		return { state, alert: null };
	}

	const remaining = state.endTime - now;
	const crossed = THRESHOLDS.filter(
		(t) => remaining <= t * 1000 && !state.fired.includes(t),
	);
	const last = crossed.at(-1);

	if (remaining <= 0) {
		return {
			state: { kind: 'go', until: state.endTime + GO_DISPLAY_MS },
			alert: last === undefined ? null : alertFor(last),
		};
	}
	if (last === undefined) {
		return { state, alert: null };
	}
	return {
		state: { ...state, fired: [...state.fired, ...crossed] },
		alert: alertFor(last),
	};
}
