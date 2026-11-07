/**
 * Sons générés avec Web Audio, et réglage « son activé » mémorisé.
 *
 * Les navigateurs (iOS en tête) n'autorisent le son qu'après une action de
 * l'utilisateur : `enable()` doit être appelé depuis un `click`, `pointerup`,
 * `touchend` ou `keydown`. Un `pointerdown` tactile ne suffit pas.
 */
import type { Alert } from './timer';

const STORAGE_KEY = 'rest-timer:sound';

/** Fréquence (Hz), durée (ms) et volume de chaque son. */
const SOUNDS: Record<Alert, { freq: number; ms: number; volume: number }> = {
	warning: { freq: 880, ms: 150, volume: 0.5 },
	tick: { freq: 880, ms: 80, volume: 0.5 },
	go: { freq: 1320, ms: 600, volume: 0.6 },
};

let ctx: AudioContext | null = null;

export function loadSoundOn(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'on';
	} catch {
		return false;
	}
}

export function saveSoundOn(on: boolean): void {
	try {
		localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
	} catch {
		// Navigation privée : le réglage ne sera simplement pas mémorisé.
	}
}

/**
 * Crée ou réveille l'`AudioContext`. À appeler pendant une action
 * utilisateur ; la promesse se résout quand le son est prêt (ou impossible).
 */
export async function enable(): Promise<void> {
	if (typeof AudioContext === 'undefined') return;
	if (!ctx) ctx = new AudioContext();
	if (ctx.state !== 'running') await ctx.resume().catch(() => {});
}

/** Coupe immédiatement tout son, y compris un bip en cours. */
export function disable(): void {
	// Sans condition sur l'état : un resume() encore en cours (pointerup du
	// même appui) doit lui aussi être suivi de la coupure.
	if (ctx) void ctx.suspend().catch(() => {});
}

export function play(sound: Alert): void {
	if (!ctx || ctx.state !== 'running') return;
	const { freq, ms, volume } = SOUNDS[sound];
	const t0 = ctx.currentTime;
	const t1 = t0 + ms / 1000;

	const osc = ctx.createOscillator();
	osc.type = 'sine';
	osc.frequency.value = freq;

	// Enveloppe courte en attaque et en relâche : pas de clic audible.
	const gain = ctx.createGain();
	gain.gain.setValueAtTime(0.0001, t0);
	gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.005);
	gain.gain.setValueAtTime(volume, Math.max(t0 + 0.005, t1 - 0.03));
	gain.gain.exponentialRampToValueAtTime(0.0001, t1);

	osc.connect(gain).connect(ctx.destination);
	osc.start(t0);
	osc.stop(t1 + 0.01);
}
