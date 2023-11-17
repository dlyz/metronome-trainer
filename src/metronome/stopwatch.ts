import _ from "lodash";
import { BeatAccentsMap, MetronomeDuration } from ".";


export interface AudioClock {
	/** Timestamp in seconds */
	readonly currentAudioTime: number;
}

export type ClickEventHandler = (beatIndex: number, noteIndex: number, accent: number) => void;


export interface MetronomeMeasureConfig {

	readonly beatsCount: number;
	readonly duration: number;
	readonly beatDuration: number;
	readonly beatDivider: number;
	readonly noteInterval: number;
	readonly beatNotesShifts: number[];
	readonly beatAccents: BeatAccentsMap,
}


interface CurrentSessionChunks {
	measures: number[],
}

export class MetronomeStopwatch {

	#suspendedElapsedMeasures: number = 0;
	#suspendedElapsedSeconds: number = 0;
	#suspendedElapsedChunks: number = 0;
	readonly #finishEvent: TimerFinishEvent;

	readonly totalMeasuresCount?: number;
	readonly totalDurationSeconds?: number;

	constructor(
		private readonly clickHandler?: ClickEventHandler,
		readonly duration?: MetronomeDuration,
		onFinished?: () => void,
	) {

		this.#finishEvent = new TimerFinishEvent(onFinished);

		if (duration) {
			const totalDuration = duration.chunks.reduce((sum, v) => sum + v, 0);

			if (duration.units === 'measures') {
				this.totalMeasuresCount = totalDuration;
			} else if (duration.units === 'seconds') {
				this.totalDurationSeconds = totalDuration;
			} else {
				throw new Error(`unsupported metronome duration units '${duration.units}'`);
			}

			if (this.totalMeasuresCount !== undefined) {
				if (this.totalMeasuresCount < 1) {
					throw new Error(`can not create MeasureDurationTimer with less than one measure. provided: ${this.totalMeasuresCount}`);
				}

				this.totalMeasuresCount = Math.floor(this.totalMeasuresCount);
			}

			if (this.totalDurationSeconds !== undefined) {
				if (this.totalDurationSeconds < 0) {
					throw new Error(`can not create SecondsDurationTimer with negative duration. provided: ${this.totalDurationSeconds}`);
				}
			}
		}

	}

	cloneReset() {
		return new MetronomeStopwatch(
			this.clickHandler,
			this.duration,
			this.#finishEvent.onFinished
		);
	}

	#runState?: RunState;

	get finished() {
		return this.#finishEvent.finished;
	}

	get elapsedMeasures() {
		return this.#suspendedElapsedMeasures + (this.#runState?.elapsedMeasures ?? 0);
	}

	get elapsedSeconds() {
		return this.#suspendedElapsedSeconds + (this.#runState?.elapsedTime ?? 0);
	}

	get elapsedChunks() {
		return this.#suspendedElapsedChunks + (this.#runState?.elapsedChunks ?? 0);
	}


	resume(
		clock: AudioClock,
		resumeAudioTime: number,
		measureConfig: MetronomeMeasureConfig,
	): CurrentSessionChunks | undefined {
		if (this.#runState) throw new Error("can not resume active stopwatch");


		let currentSessionChunks: CurrentSessionChunks | undefined;

		if (this.duration) {
			let currentSessionMeasureChunks;

			// todo: maintain elapsedChunks. it should be recalculated after the pause according to the below algorithm
			if (this.duration.units === "seconds") {
				currentSessionMeasureChunks = findRemainingChunks(this.duration.chunks, this.#suspendedElapsedSeconds);
				currentSessionMeasureChunks = convertSecondsToMeasuresChunks(currentSessionMeasureChunks, measureConfig.duration);
			} else {
				currentSessionMeasureChunks = findRemainingChunks(this.duration.chunks, this.#suspendedElapsedMeasures);
			}

			currentSessionChunks = { measures: currentSessionMeasureChunks };
		}

		this.#runState = new RunState(
			clock,
			resumeAudioTime,
			measureConfig,
			currentSessionChunks,
			this.clickHandler,
			this.#finishEvent
		);

		return _.cloneDeep(currentSessionChunks);
	}

	suspend(): void {
		if (!this.#runState) throw new Error("can not suspend paused stopwatch");

		this.#runState.dispose();
		this.#suspendedElapsedMeasures += this.#runState.elapsedMeasures;
		this.#suspendedElapsedSeconds += this.#runState.elapsedTime;

		if (this.duration) {
			let remainingChunks;
			if (this.duration.units === "seconds") {
				remainingChunks = findRemainingChunks(this.duration.chunks, this.#suspendedElapsedSeconds);
			} else {
				remainingChunks = findRemainingChunks(this.duration.chunks, this.#suspendedElapsedMeasures);
			}
			this.#suspendedElapsedChunks = this.duration.chunks.length - remainingChunks.length;
		}


		this.#runState = undefined;
	}
}

function findRemainingChunks(chunks: number[], elapsed: number): number[] {

	for (let index = 0; index < chunks.length; ++index) {
		elapsed -= chunks[index];
		if (elapsed < 0) {
			return [ -elapsed, ...chunks.slice(index + 1)];
		}
	}

	return [0];
}

function convertSecondsToMeasuresChunks(chunks: number[], measureDuration: number): number[] {
	const result = [];
	let carry = 0;
	for (const chunk of chunks) {
		const untilNextChunk = chunk + carry;
		// we require at least one measure per chunk
		const measures = Math.max(1, Math.ceil(untilNextChunk/measureDuration));
		result.push(measures);
		const actualChunk = measures * measureDuration;

		// for current strategy carry is disabled: we always round seconds up to integer measures
		// carry = untilNextChunk - actualChunk;
	}

	return result;
}

class RunState {

	constructor(
		readonly clock: AudioClock,
		readonly resumeAudioTime: number,
		readonly measureConfig: MetronomeMeasureConfig,
		readonly measuresChunks: CurrentSessionChunks | undefined,
		readonly clickHandler: ClickEventHandler | undefined,
		readonly finishEvent: TimerFinishEvent,
	) {
		this.noteIndex = 0;
		this.beatIndex = 0;
		this.beatExpectedTime = resumeAudioTime;
		if (measuresChunks) {
			this.measuresCount = measuresChunks.measures.reduce((sum, v) => sum + v, 0);
		}

		this.#reschedule(resumeAudioTime - clock.currentAudioTime);
	}

	readonly measuresCount: number | undefined;

	#timeoutToken: number | undefined;
	#intervalToken: number | undefined;

	#reschedule = (seconds: number) => {
		clearTimeout(this.#timeoutToken);
		clearInterval(this.#intervalToken);
		this.#timeoutToken = setTimeout(this.#startInterval, seconds * 1000);
	}

	#startInterval = () => {
		this.#intervalToken = setInterval(this.#click, this.measureConfig.noteInterval * 1000);
		this.#click();
	};

	dispose() {
		clearTimeout(this.#timeoutToken);
		clearInterval(this.#intervalToken);
	}

	beatExpectedTime: number;
	beatIndex: number;
	noteIndex: number;
	#elapsedMeasures: number = -1;


	get elapsedMeasures() {
		return Math.max(0, this.#elapsedMeasures);
	}

	get elapsedTime() {
		return Math.max(0, this.clock.currentAudioTime - this.resumeAudioTime);
	}

	get elapsedChunks() {
		if (!this.measuresChunks) return 0;
		const measures = this.measuresChunks.measures;
		let prefix = 0;

		for (let index = 0; index < measures.length; index++) {
			const chunk = measures[index];
			prefix += chunk;
			if (this.#elapsedMeasures < prefix) return index;
		}

		return measures.length;
	}

	noteErrorSum = 0;
	noteErrorCount = 0;

	static readonly #errorThreshold = 0.008;

	#click = () => {

		if (this.finishEvent.finished) return;

		const m = this.measureConfig;

		const noteExpectedTime = this.beatExpectedTime + m.noteInterval * this.noteIndex;
		const noteActualTime = this.clock.currentAudioTime;

		const timeError = noteActualTime - noteExpectedTime;
		this.noteErrorSum += timeError;
		++this.noteErrorCount;


		let accent = m.beatAccents[this.beatIndex] ?? 1;
		if (this.noteIndex !== 0 && accent !== 0) {
			accent = 1;
		}

		if (this.beatIndex === 0 && this.noteIndex === 0) {
			const shouldContinue = this.#advanceElapsedMeasures(noteExpectedTime);
			if (!shouldContinue) {
				return;
			}
		}

		this.clickHandler?.(this.beatIndex, this.noteIndex, accent);


		++this.noteIndex;
		if (this.noteIndex === m.beatDivider) {
			++this.beatIndex;
			if (this.beatIndex === m.beatsCount) {
				this.beatIndex = 0;
			}

			this.beatExpectedTime += m.beatDuration;
			this.noteIndex = 0;
		}


		// todo: make correction dependent on the noteErrorInterval and noteErrorCount
		const avgError = this.noteErrorSum / this.noteErrorCount;
		if (this.noteErrorCount >= 8 && Math.abs(avgError) > RunState.#errorThreshold || Math.abs(avgError)*4 > m.noteInterval) {
			this.noteErrorSum = this.noteErrorCount = 0;
			const nextNoteExpectedTime = this.beatExpectedTime + m.noteInterval * this.noteIndex;
			const correction = (avgError > 0 ? avgError : (avgError / 2)) / 10;
			const nextInterval = nextNoteExpectedTime - this.clock.currentAudioTime - correction;
			//console.log(`meas: ${this.#elapsedMeasures} correction. error: ${avgError}`);
			this.#reschedule(nextInterval);
		} else if (this.noteErrorCount >= 16 ) {
			this.noteErrorSum = this.noteErrorCount = 0;
		}
	}


	#advanceElapsedMeasures(noteExpectedTime: number) {

		++this.#elapsedMeasures;
		if (this.measuresCount !== this.#elapsedMeasures) return true;

		if (this.finishEvent.finished) return false;

		const remainedTime = noteExpectedTime - this.clock.currentAudioTime;
		if (remainedTime <= 0) {
			this.finishEvent.finish();
			return false;
		}

		--this.#elapsedMeasures;
		clearTimeout(this.#timeoutToken);
		clearInterval(this.#intervalToken);
		this.#timeoutToken = setTimeout(() => this.#advanceElapsedMeasures(noteExpectedTime), Math.max(2, remainedTime * 1000));

		return false;
	}
}



// class DurationTimer {

// 	#finishTimeoutToken?: number;
// 	readonly #finishAudioTime: number;

// 	constructor(
// 		readonly clock: AudioClock,
// 		resumeAudioTime: number,
// 		readonly finishEvent: TimerFinishEvent,
// 		remainedDuration: number,
// 	) {
// 		this.#finishAudioTime = resumeAudioTime + remainedDuration;

// 		if (!this.finishEvent.finished) {
// 			const estimatedCompletionDuration = (this.#finishAudioTime - clock.currentAudioTime) * 1000 + 2;
// 			this.#finishTimeoutToken = setTimeout(this.#onTimeoutCompleted, estimatedCompletionDuration);
// 		}
// 	}

// 	get actualRemainedDuration() {
// 		return this.#finishAudioTime - this.clock.currentAudioTime;
// 	}


// 	stop() {
// 		clearTimeout(this.#finishTimeoutToken);
// 	}

// 	#onTimeoutCompleted = () => {

// 		if (this.finishEvent.finished) return;

// 		if (this.clock.currentAudioTime < this.#finishAudioTime) {
// 			this.#finishTimeoutToken = setTimeout(this.#onTimeoutCompleted, 2);
// 			return;
// 		}


// 		this.finishEvent.finish();
// 	}
// }




class TimerFinishEvent {

	constructor(readonly onFinished?: () => void) {

	}

	#finishCompleted = false;

	get finished() {
		return this.#finishCompleted;
	}

	finish() {
		this.#finishCompleted = true;
		this.onFinished?.();
	};
}



