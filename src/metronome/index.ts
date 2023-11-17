import _ from "lodash";
import { MetronomeDuration } from "./core";
import { MetronomeMeasureConfig, MetronomeStopwatch, ClickEventHandler } from "./stopwatch";
import { Player } from "./Player";
import { SimplePlayer } from "./Player";

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

class NoteScheduler {

	readonly #intervalToken: number;
	#nextMeasureToScheduleAudioTime: number;
	#chunkRemainedMeasures?: number;
	#chunksQueue: number[];

	constructor(
		readonly measureConfig: MetronomeMeasureConfig,
		readonly player: Player,
		readonly stopwatch: MetronomeStopwatch,
	) {
		this.#nextMeasureToScheduleAudioTime = this.player.currentAudioTime + 0.1;

		const chunks = stopwatch.resume(player, this.#nextMeasureToScheduleAudioTime, this.measureConfig);
		this.#chunksQueue = chunks?.measures ?? [];
		if (chunks) {
			this.#chunkRemainedMeasures = this.#chunksQueue.shift() ?? 0;
		}
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
			const chunkRemainedMeasuresBeforeCurrent = this.#chunkRemainedMeasures;
			if (this.#chunkRemainedMeasures !== undefined) {
				if (this.#chunkRemainedMeasures === 0) {
					if (this.#chunksQueue.length !== 0) {
						this.#chunkRemainedMeasures = this.#chunksQueue.shift()!;
					} else {
						this.#scheduleTransition(this.#nextMeasureToScheduleAudioTime, 0);
						clearInterval(this.#intervalToken);
						return;
					}
				}

				--this.#chunkRemainedMeasures;
			}

			this.#nextMeasureToScheduleAudioTime = this.#scheduleMeasure(
				this.#nextMeasureToScheduleAudioTime,
				chunkRemainedMeasuresBeforeCurrent
			);

		}
	}

	#scheduleMeasure(startTime: number, chunkRemainedMeasuresBeforeCurrent: number | undefined): number {

		const { beatsCount, beatDuration, beatAccents, beatNotesShifts } = this.measureConfig;

		let time = startTime;

		let skipFirstBeatNote = this.#scheduleTransition(time, chunkRemainedMeasuresBeforeCurrent);
		skipFirstBeatNote &&= beatNotesShifts[0] === 0;
		for (let index = 0; index < beatsCount; index++, time += beatDuration) {

			const accent = beatAccents[index] ?? 1;
			if (accent !== 0) {
				if (!skipFirstBeatNote) {
					this.player.scheduleClick(time + beatNotesShifts[0], accent);
				}
				for (let noteIndex = 1; noteIndex < beatNotesShifts.length; ++noteIndex) {
					this.player.scheduleClick(time + beatNotesShifts[noteIndex], 1);
				}
			}

			skipFirstBeatNote = false;
		}

		return time;
	}

	#scheduleTransition(time: number, chunkRemainedMeasuresBeforeCurrent: number | undefined): boolean {

		if (chunkRemainedMeasuresBeforeCurrent === 1) {
			this.player.scheduleTransition(time, 2);
			return true;
		} else if (chunkRemainedMeasuresBeforeCurrent === 0) {
			this.player.scheduleTransition(time, 1);
			return true;
		} else {
			return false;
		}
	}
}



