import _ from "lodash";
import { MetronomeDuration } from "./core";
import { AudioClock, MetronomeMeasureConfig, MetronomeStopwatch, ClickEventHandler } from "./stopwatch";

export { ClickEventHandler }
export * from "./core";

export interface MetronomeOptions {

	/**
	 * Measure time signature
	 * @default [4, 4]
	 */
	signature: [number, number],

	/**
	 * Beats per minute for notes of length 1/(denominator of the {@link signature})
	 * @default 60
	 */
	bpm: number,

	/**
	 * Describes what to play on each beat duration.
	 * `number` specifies even notes count for each beat duration.
	 * @default 1
	 */
	beatDivider: number,

	/**
	 * Maps beat index (from 0)
	 * to accent intensity (0 is silent, 1 is normal, 2 and 3 are allowed).
	 * Default intensity is 1.
	 * @default { 0: 3 }
	 */
	beatAccents: BeatAccentsMap,
}

export type BeatAccentsMap = Partial<Record<number, 0 | 1 | 2 | 3>>;

export function getFullOptions(options: Partial<MetronomeOptions> | undefined): MetronomeOptions {
	return {
		bpm: 60,
		signature: [4, 4],
		beatAccents: { 0: 3 },
		beatDivider: 1,
		..._.omitBy(options, _.isUndefined),
	}
}

export class Metronome {

	#options: MetronomeOptions;

	#scheduler?: NoteScheduler;
	#stopwatch?: MetronomeStopwatch;
	#onFinished?: () => void;

	constructor() {
		this.#options = getFullOptions(undefined);
	}

	options() {
		return {...this.#options};
	}

	update(options: Partial<MetronomeOptions>) {

		this.#options = {
			...this.#options,
			...options,
		};

		// todo: options validation

		if (this.#scheduler) {
			this.pause();
			this.resume();
		}
	}

	restart(
		duration?: MetronomeDuration,
		clickEventHandler?: ClickEventHandler,
		onFinished?: () => void,
	) {
		this.stop();

		this.#onFinished = onFinished;
		let totalMeasures;
		let totalDuration;
		if (duration !== undefined) {
			if (duration.type === 'measures') {
				totalMeasures = duration.value;
			} else if (duration.type === 'seconds') {
				totalDuration = duration.value;
			} else {
				throw new Error(`unsupported metronome duration type '${(duration as any).type}'`);
			}
		}

		this.#stopwatch = new MetronomeStopwatch(
			clickEventHandler,
			totalMeasures,
			totalDuration,
			this.#onTimerFinished,
		);

		this.resume();
	}

	#onTimerFinished = () => {
		this.pause();
		this.#onFinished?.();
	}

	stop() {
		if (!this.#stopwatch) return;

		this.pause();
		this.#stopwatch = undefined;
		this.#onFinished = undefined;
	}

	pause() {
		if (!this.#scheduler) return;

		this.#scheduler.close();
		this.#scheduler = undefined;
	}

	resume() {
		// playing
		if (this.#scheduler) return true;

		// stopped, can not resume
		if (!this.#stopwatch) return false;

		if (this.#stopwatch.finished) {
			this.#stopwatch = this.#stopwatch.cloneReset();
		}

		this.#scheduler = new NoteScheduler(
			getMeasureConfig(this.#options),
			new SimplePlayer(),
			this.#stopwatch,
		);

		return true;
	}

	get elapsedSeconds() {
		return this.#stopwatch?.elapsedTime ?? 0;
	}

	get elapsedMeasures() {
		return this.#stopwatch?.elapsedMeasures ?? 0;
	}
}

function getMeasureConfig(options: MetronomeOptions): MetronomeMeasureConfig {
	const { signature, bpm, beatDivider } = options;

	const beatsCount = signature[0];
	const bps = bpm / 60;
	const beatDuration = 1 / bps;

	let duration = 0;
	for (let index = 0; index < beatsCount; index++, duration += beatDuration) {
	}

	const beatNotesShifts = [0];
	const noteDuration = beatDuration / beatDivider;
	for	(let index = 1; index < beatDivider; ++index) {
		beatNotesShifts.push(beatNotesShifts[index-1] + noteDuration);
	}

	return {
		beatsCount,
		duration,
		beatDuration,
		beatDivider,
		beatNotesShifts,
		noteInterval: beatDuration / beatDivider,
		beatAccents: options.beatAccents,
	}
}

class NoteScheduler {

	readonly #intervalToken: number;
	#nextMeasureToScheduleAudioTime: number;
	#remainedMeasures?: number;

	constructor(
		readonly measureConfig: MetronomeMeasureConfig,
		readonly player: Player,
		readonly stopwatch: MetronomeStopwatch,
	) {
		this.#nextMeasureToScheduleAudioTime = this.player.currentAudioTime + 0.1;

		this.#remainedMeasures = stopwatch.remainedMeasures;
		stopwatch.resume(player, this.#nextMeasureToScheduleAudioTime, this.measureConfig);
		this.#intervalToken = setInterval(this.#onIntervalCallback, NoteScheduler.#workerIntervalS * 1000);
		this.#onIntervalCallback();
	}

	close() {
		this.player.close();
		clearInterval(this.#intervalToken);
		this.stopwatch.suspend();
	}

	static readonly #workerIntervalS = 7;
	static readonly #prescheduledIntervalS = 7 * 2.5;

	#onIntervalCallback = () => {

		const currentTime = this.player.currentAudioTime;
		const scheduleUntil = currentTime + NoteScheduler.#prescheduledIntervalS;

		while (this.#nextMeasureToScheduleAudioTime < scheduleUntil) {
			if (this.#remainedMeasures !== undefined) {
				if (this.#remainedMeasures === 0) {
					clearInterval(this.#intervalToken);
					return;
				}

				--this.#remainedMeasures;
			}

			this.#nextMeasureToScheduleAudioTime = this.#scheduleMeasure(
				this.#nextMeasureToScheduleAudioTime
			);

		}
	}

	#scheduleMeasure(startTime: number): number {

		const { beatsCount, beatDuration, beatAccents, beatNotesShifts } = this.measureConfig;

		let time = startTime;

		for (let index = 0; index < beatsCount; index++, time += beatDuration) {

			const accent = beatAccents[index] ?? 1;
			if (accent !== 0) {
				this.player.scheduleNote(time + beatNotesShifts[0], accent);
				for (let noteIndex = 1; noteIndex < beatNotesShifts.length; ++noteIndex) {
					this.player.scheduleNote(time + beatNotesShifts[noteIndex], 1);
				}
			}
		}

		return time;
	}
}


interface Player extends AudioClock {
	readonly currentAudioTime: number;
	scheduleNote(audioTime: number, accentValue: 1 | 2 | 3): void;
	close(): void;
}


class SimplePlayer implements Player {

	readonly #audioContext: AudioContext;
	readonly #oscillator: OscillatorNode;
	readonly #gain: GainNode;
	readonly #ac2: AudioContext;

	constructor(
	) {
		this.#audioContext = new AudioContext();

		this.#oscillator = this.#audioContext.createOscillator();
		this.#oscillator.type = "sine";
		this.#oscillator.frequency.value = 1000;

		this.#gain = this.#audioContext.createGain();
		this.#gain.gain.value = 0;

		// There's a "node graph"  oscillator->gain->destination
		this.#oscillator.connect(this.#gain);
		this.#gain.connect(this.#audioContext.destination);

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
			case 2: return [baseFreq + (baseFreq/12*4), 1];
			// 7 semitones
			default: return [baseFreq + (baseFreq/12*7), 1];
		}
	}

	scheduleNote(audioTime: number, accentValue: 1 | 2 | 3) {

		const freqParam = this.#oscillator.frequency;
		const gainParam = this.#gain.gain;

		const [frequency, volume] = SimplePlayer.#getAccentParams(accentValue);
		const maxGain = 3;
		const minGain = 0;
		const gain = maxGain * volume;

		freqParam.setValueAtTime(frequency, audioTime);
		gainParam.setValueAtTime(minGain, audioTime)
		gainParam.linearRampToValueAtTime(gain, audioTime + .001);
		gainParam.linearRampToValueAtTime(minGain, audioTime + .001 + .01);
	}

}

