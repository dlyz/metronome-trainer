import _ from "lodash";
import { MetronomeDuration } from "./core";
import { MetronomeMeasureConfig, MetronomeStopwatch, ClickEventHandler } from "./stopwatch";
import { SimplePlayer } from "./Player";
import { NoteScheduler } from "./NoteScheduler";

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
		this.#stopwatch = new MetronomeStopwatch(
			clickEventHandler,
			duration,
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
		return this.#stopwatch?.elapsedSeconds ?? 0;
	}

	get elapsedMeasures() {
		return this.#stopwatch?.elapsedMeasures ?? 0;
	}

	get elapsedChunks() {
		return this.#stopwatch?.elapsedChunks ?? 0;
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

