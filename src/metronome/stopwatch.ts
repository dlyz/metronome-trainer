import { BeatAccentsMap } from ".";


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



export class MetronomeStopwatch {

	#suspendedElapsedMeasures: number = 0;
	#suspendedElapsedTime: number = 0;
	readonly #finishEvent: TimerFinishEvent;

	constructor(
		private readonly clickHandler?: ClickEventHandler,
		readonly totalMeasuresCount?: number,
		readonly totalDuration?: number,
		onFinished?: () => void,
	) {

		this.#finishEvent = new TimerFinishEvent(onFinished);

		if (this.totalMeasuresCount !== undefined) {
			if (this.totalMeasuresCount < 1) {
				throw new Error(`can not create MeasureDurationTimer with less than one measure. provided: ${this.totalMeasuresCount}`);
			}

			this.totalMeasuresCount = Math.floor(this.totalMeasuresCount);
		}

		if (this.totalDuration !== undefined) {
			if (this.totalDuration < 0) {
				throw new Error(`can not create SecondsDurationTimer with negative duration. provided: ${this.totalDuration}`);
			}
		}

	}

	cloneReset() {
		return new MetronomeStopwatch(
			this.clickHandler,
			this.totalMeasuresCount,
			this.totalDuration,
			this.#finishEvent.onFinished
		);
	}

	#runState?: RunState;
	#durationTimer?: DurationTimer;

	get finished() {
		return this.#finishEvent.finished;
	}

	get elapsedMeasures() {
		return this.#suspendedElapsedMeasures + (this.#runState?.elapsedMeasures ?? 0);
	}

	get remainedMeasures() {
		if (this.totalMeasuresCount !== undefined) {
			return this.totalMeasuresCount - this.elapsedMeasures;
		} else {
			return undefined;
		}
	}

	get elapsedTime() {
		const result = this.#suspendedElapsedTime + (this.#runState?.elapsedTime ?? 0);
		if (this.totalDuration !== undefined) {
			return Math.min(this.totalDuration, result);
		} else {
			return result;
		}
	}

	resume(
		clock: AudioClock,
		resumeAudioTime: number,
		measureConfig: MetronomeMeasureConfig,
	) {
		if (this.#runState) throw new Error("can not resume active stopwatch");

		if (this.totalDuration !== undefined) {
			this.#durationTimer = new DurationTimer(
				clock,
				resumeAudioTime,
				this.#finishEvent,
				this.totalDuration - this.#suspendedElapsedTime
			);
		}

		this.#runState = new RunState(
			clock,
			resumeAudioTime,
			measureConfig,
			this.totalMeasuresCount === undefined ? undefined : this.totalMeasuresCount - this.#suspendedElapsedMeasures,
			this.clickHandler,
			this.#finishEvent
		);

	}

	suspend(): void {
		if (!this.#runState) throw new Error("can not suspend paused stopwatch");

		this.#durationTimer?.stop();
		this.#durationTimer = undefined;

		this.#runState.dispose();
		this.#suspendedElapsedMeasures += this.#runState.elapsedMeasures;
		this.#suspendedElapsedTime += this.#runState.elapsedTime;
		this.#runState = undefined;
	}
}


class RunState {

	constructor(
		readonly clock: AudioClock,
		readonly resumeAudioTime: number,
		readonly measureConfig: MetronomeMeasureConfig,
		readonly measuresCount: number | undefined,
		readonly clickHandler: ClickEventHandler | undefined,
		readonly finishEvent: TimerFinishEvent,
	) {
		this.noteIndex = 0;
		this.beatIndex = 0;
		this.beatExpectedTime = resumeAudioTime;
		this.#reschedule(resumeAudioTime - clock.currentAudioTime);
	}

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
		this.#timeoutToken = setTimeout(() => this.#advanceElapsedMeasures(noteExpectedTime), Math.max(2, remainedTime * 1000));

		return false;
	}
}



class DurationTimer {

	#finishTimeoutToken?: number;
	readonly #finishAudioTime: number;

	constructor(
		readonly clock: AudioClock,
		resumeAudioTime: number,
		readonly finishEvent: TimerFinishEvent,
		remainedDuration: number,
	) {
		this.#finishAudioTime = resumeAudioTime + remainedDuration;

		if (!this.finishEvent.finished) {
			const estimatedCompletionDuration = (this.#finishAudioTime - clock.currentAudioTime) * 1000 + 2;
			this.#finishTimeoutToken = setTimeout(this.#onTimeoutCompleted, estimatedCompletionDuration);
		}
	}

	get actualRemainedDuration() {
		return this.#finishAudioTime - this.clock.currentAudioTime;
	}


	stop() {
		clearTimeout(this.#finishTimeoutToken);
	}

	#onTimeoutCompleted = () => {

		if (this.finishEvent.finished) return;

		if (this.clock.currentAudioTime < this.#finishAudioTime) {
			this.#finishTimeoutToken = setTimeout(this.#onTimeoutCompleted, 2);
			return;
		}


		this.finishEvent.finish();
	}
}




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



