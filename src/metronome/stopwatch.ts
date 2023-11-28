import _ from "lodash";
import { ClickEventHandler, MetronomePosition } from "./core";
import { MetronomeCursor, MetronomeTaskImpl } from "./measureCalc";


export interface AudioClock {
	/** Timestamp in seconds */
	readonly currentAudioTime: number;
}


export class MetronomeStopwatch {

	readonly #finishEvent;
	readonly taskCursor;

	constructor(
		readonly clock: AudioClock,
		readonly task: MetronomeTaskImpl,
		readonly clickHandler?: ClickEventHandler,
		onFinished?: () => void,
	) {
		this.#finishEvent = new TimerFinishEvent(onFinished);
		this.taskCursor = new MetronomeCursor(task);
		this.resume();
	}

	#runState?: RunState;

	get finished() {
		return this.#finishEvent.finished;
	}

	resume() {
		if (this.#runState) throw new Error("can not resume active stopwatch");

		this.#runState = new RunState(
			this.clock,
			this.taskCursor,
			this.clickHandler,
			this.#finishEvent
		);
	}

	suspend(): void {
		if (!this.#runState) throw new Error("can not suspend paused stopwatch");

		this.#runState.dispose();
		this.#runState = undefined;
	}

	close() {
		this.#runState?.dispose();
	}
}


class RunState {

	constructor(
		readonly clock: AudioClock,
		readonly cursor: MetronomeCursor,
		readonly clickHandler: ClickEventHandler | undefined,
		readonly finishEvent: TimerFinishEvent,
	) {
		this.#reschedule(cursor.noteStartTime - clock.currentAudioTime);
	}

	#timeoutToken: number | undefined;
	#intervalToken: number | undefined;

	#reschedule = (seconds: number) => {
		this.noteErrorSum = this.noteErrorCount = 0;
		clearInterval(this.#intervalToken);
		this.#timeoutToken = setTimeout(this.#startInterval, seconds * 1000);
	}

	#startInterval = () => {
		this.#intervalToken = setInterval(this.#click, this.cursor.part.measure.noteInterval * 1000);
		this.#click();
	};

	dispose() {
		clearTimeout(this.#timeoutToken);
		clearInterval(this.#intervalToken);
	}

	noteErrorSum = 0;
	noteErrorCount = 0;

	static readonly #errorThreshold = 0.008;

	#click = () => {

		if (this.finishEvent.finished) return;

		if (this.cursor.finished) {
			this.#scheduleFinish();
			return;
		}

		const cursor = this.cursor;
		const part = cursor.part;
		const measure = part.measure;

		const noteExpectedTime = this.cursor.noteStartTime;
		const noteActualTime = this.clock.currentAudioTime;

		const timeError = noteActualTime - noteExpectedTime;
		this.noteErrorSum += timeError;
		++this.noteErrorCount;



		let accent = measure.beatAccents[cursor.measureBeatIndex] ?? 1;
		if (cursor.beatNoteIndex !== 0 && accent !== 0) {
			accent = 1;
		}

		this.clickHandler?.({
			partIndex: cursor.partIndex,
			partMeasureIndex: cursor.partMeasureIndex,
			measureBeatIndex: cursor.measureBeatIndex,
			beatNoteIndex: cursor.beatNoteIndex,
			accent,
		});

		cursor.advanceNote();
		if (cursor.finished) {
			this.#scheduleFinish();
		} else if (cursor.part.measure.noteInterval !== measure.noteInterval) {
			// interval has changed
			this.#reschedule(cursor.noteStartTime - this.clock.currentAudioTime);
		} else {

			// todo: make correction dependent on the noteErrorInterval and noteErrorCount
			const avgError = this.noteErrorSum / this.noteErrorCount;

			if (cursor.noteStartTime < noteActualTime) {
				// next note should already be fired;
				this.#reschedule(0);
			} else if (this.noteErrorCount >= 8 && Math.abs(avgError) > RunState.#errorThreshold || Math.abs(avgError)*4 > measure.noteInterval) {
				const nextNoteExpectedTime = cursor.noteStartTime;
				const correction = (avgError > 0 ? avgError : (avgError / 2)) / 10;
				const nextInterval = nextNoteExpectedTime - this.clock.currentAudioTime - correction;
				//console.log(`meas: ${this.#elapsedMeasures} correction. error: ${avgError}`);
				this.#reschedule(nextInterval);
			} else if (this.noteErrorCount >= 16 ) {
				this.noteErrorSum = this.noteErrorCount = 0;
			}
		}
	}

	#scheduleFinish = () => {

		clearInterval(this.#intervalToken);

		if (this.finishEvent.finished) return;

		const remainedTime = this.cursor.measureStartTime - this.clock.currentAudioTime;
		if (remainedTime <= 0) {
			this.finishEvent.finish();
			return;
		}

		this.#timeoutToken = setTimeout(this.#scheduleFinish, Math.max(2, remainedTime * 1000));
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



