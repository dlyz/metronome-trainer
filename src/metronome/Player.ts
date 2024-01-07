import { AudioClock } from "./stopwatch";

export interface Player extends AudioClock {

	masterVolume: number;

	readonly currentAudioTime: number;

	/**
	 * Returns click finish time.
	 */
	scheduleClick(audioTime: number, accentValue: 1 | 2 | 3): number;

	/**
	 * Returns transition finish time.
	 */
	scheduleTransition(audioTime: number, transitionLevel: 1 | 2): number;

	suspend(): void;
	resume(): void;
	close(): void;
}

export class StartShiftedPlayer implements Player {
	constructor(
		readonly player: Player,
		readonly startShift: number
	) {
	}

	get masterVolume() { return this.player.masterVolume; }
	set masterVolume(value: number) { this.player.masterVolume = value; }

	get currentAudioTime() {
		return this.player.currentAudioTime - this.startShift;
	}

	scheduleClick(audioTime: number, accentValue: 1 | 2 | 3) {
		return this.player.scheduleClick(audioTime + this.startShift, accentValue) - this.startShift;
	}

	scheduleTransition(audioTime: number, transitionLevel: 1 | 2) {
		return this.player.scheduleTransition(audioTime + this.startShift, transitionLevel) - this.startShift;
	}

	suspend() { return this.player.suspend(); }
	resume() { return this.player.resume(); }
	close() { return this.player.close(); }
}

export function createSimplePlayer(): Player {
	return new StartShiftedPlayer(new SimplePlayer(), 0.1);
}

class SimplePlayer implements Player {

	readonly #audioContext: AudioContext;
	readonly #oscillator: OscillatorNode;
	readonly #gain: GainNode;
	readonly #masterVolumeGain: GainNode;
	readonly #ac2: AudioContext;

	constructor() {
		this.#audioContext = new AudioContext();

		this.#oscillator = this.#audioContext.createOscillator();
		this.#oscillator.type = "sine";
		this.#oscillator.frequency.value = 1000;

		this.#gain = this.#audioContext.createGain();
		this.#gain.gain.value = 0;

		this.#masterVolumeGain = this.#audioContext.createGain();

		// There's a "node graph"  oscillator->gain->destination
		this.#oscillator.connect(this.#gain);
		this.#gain.connect(this.#masterVolumeGain);
		this.#masterVolumeGain.connect(this.#audioContext.destination);

		this.#oscillator.start();


		// on mobile browsers for some reason metronome is silent
		// probably because audio can not start in time probably because of short notes.
		// to prevent this, playing something almost silent in background
		this.#ac2 = new AudioContext();
		const tmposc = this.#ac2.createOscillator();
		tmposc.frequency.value = 1;
		const tmpgane = this.#ac2.createGain();
		tmpgane.gain.value = 0.01;
		tmposc.connect(tmpgane);
		tmpgane.connect(this.#ac2.destination);
		tmposc.start();
	}

	get currentAudioTime() { return this.#audioContext.currentTime; }


	get masterVolume() { return this.#masterVolumeGain.gain.value; }
	set masterVolume(value: number) { this.#masterVolumeGain.gain.value = value; }

	suspend() {
		this.#audioContext.suspend();
		this.#ac2.suspend();
	}

	resume() {
		this.#audioContext.resume();
		this.#ac2.resume();
	}

	close() {
		this.#oscillator.stop();
		this.#audioContext.close();
		this.#ac2.close();
	}

	static #getAccentParams(accentValue: 1 | 2 | 3) {
		const baseFreq = 1000;
		switch (accentValue) {
			case 1: return [baseFreq, 0.85];
			// 4 semitones
			case 2: return [baseFreq + (baseFreq / 12 * 4), 1];
			// 7 semitones
			default: return [baseFreq + (baseFreq / 12 * 7), 1];
		}
	}

	scheduleClick(audioTime: number, accentValue: 1 | 2 | 3) {

		const freqParam = this.#oscillator.frequency;
		const gainParam = this.#gain.gain;

		const [frequency, volume] = SimplePlayer.#getAccentParams(accentValue);
		const maxGain = 2;
		const minGain = 0;
		const gain = maxGain * volume;

		const attack = 0.001;
		const release = 0.01;

		freqParam.setValueAtTime(frequency, audioTime);
		gainParam.setValueAtTime(minGain, audioTime);
		gainParam.linearRampToValueAtTime(gain, audioTime + attack);
		gainParam.linearRampToValueAtTime(minGain, audioTime + attack + release);

		return audioTime + attack + release;
	}

	scheduleTransition(audioTime: number, transitionLevel: 1 | 2): number {
		const freqParam = this.#oscillator.frequency;
		const gainParam = this.#gain.gain;

		const [frequency, volume] = [transitionLevel === 1 ? 440 : 880, 1];
		const maxGain = 2;
		const minGain = 0;
		const gain = maxGain * volume;

		const attack = 0.005;
		const release = 0.01;
		const pause = transitionLevel === 1 ? 0.08 : 0.04;

		for (let index = 0; index < (transitionLevel === 1 ? 3 : 2); index++) {
			freqParam.setValueAtTime(frequency, audioTime);
			gainParam.setValueAtTime(minGain, audioTime);
			gainParam.linearRampToValueAtTime(gain, audioTime + attack);
			gainParam.linearRampToValueAtTime(minGain, audioTime + attack + release);
			audioTime += attack + release + pause;
		}

		// todo: use package adsr-envelope

		return audioTime;
	}
}

