import _ from "lodash";
import { ClickEventHandler, MetronomePosition } from "./core";
import { MetronomeCursor, MetronomeTaskImpl } from "./measureCalc";


export interface AudioClock {
	/** Timestamp in seconds */
	readonly currentAudioTime: number;
}



export class MetronomeStopwatch {

	readonly #cursor;

	constructor(
		readonly clock: AudioClock,
		readonly task: MetronomeTaskImpl,
		readonly clickHandler?: ClickEventHandler,
		onFinished?: () => void,
	) {
		this.#cursor = new StopwatchCursor(task, onFinished);
		this.resume();
	}

	#runState?: RunState;

	get position() { return this.#cursor.currentNotePosition; }

	get lastNotePosition() { return this.#cursor.lastNotePosition; }

	get finished() {
		return this.#cursor.finished;
	}

	resume() {
		if (this.#runState) throw new Error("can not resume active stopwatch");

		this.#runState = new RunState(
			this.clock,
			this.#cursor,
			this.clickHandler
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
		readonly cursor: StopwatchCursor,
		readonly clickHandler: ClickEventHandler | undefined,
	) {
		this.#reschedule(cursor.nextNoteCursor.noteStartTime - clock.currentAudioTime);
	}

	#timeoutToken: number | undefined;
	#intervalToken: number | undefined;

	#reschedule = (seconds: number) => {
		this.noteErrorSum = this.noteErrorCount = 0;
		clearInterval(this.#intervalToken);
		this.#timeoutToken = setTimeout(this.#startInterval, seconds * 1000);
	}

	#startInterval = () => {
		this.#intervalToken = setInterval(this.#click, this.cursor.nextNoteCursor.part.measure.noteInterval * 1000);
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

		const cursor = this.cursor;
		if (cursor.finished) return;

		const nextNoteCursor = cursor.nextNoteCursor;

		if (nextNoteCursor.finished) {
			this.#scheduleFinish();
			return;
		}

		const part = nextNoteCursor.part;
		const measure = part.measure;

		const noteExpectedTime = nextNoteCursor.noteStartTime;
		const noteActualTime = this.clock.currentAudioTime;

		const timeError = noteActualTime - noteExpectedTime;
		this.noteErrorSum += timeError;
		++this.noteErrorCount;



		let accent = measure.beatAccents[nextNoteCursor.measureBeatIndex] ?? 1;
		if (nextNoteCursor.beatNoteIndex !== 0 && accent !== 0) {
			accent = 1;
		}

		cursor.advanceNoteBeforeClick();
		this.clickHandler?.({
			...cursor.currentNotePosition,
			accent,
		});

		if (nextNoteCursor.finished) {
			this.#scheduleFinish();
		} else if (nextNoteCursor.part.measure.noteInterval !== measure.noteInterval) {
			// interval has changed
			this.#reschedule(nextNoteCursor.noteStartTime - this.clock.currentAudioTime);
		} else {

			// todo: make correction dependent on the noteErrorInterval and noteErrorCount
			const avgError = this.noteErrorSum / this.noteErrorCount;

			if (nextNoteCursor.noteStartTime < noteActualTime) {
				// next note should already be fired;
				this.#reschedule(0);
			} else if (this.noteErrorCount >= 8 && Math.abs(avgError) > RunState.#errorThreshold || Math.abs(avgError)*4 > measure.noteInterval) {
				const nextNoteExpectedTime = nextNoteCursor.noteStartTime;
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

		const cursor = this.cursor;
		if (cursor.finished) return;

		const remainedTime = cursor.nextNoteCursor.measureStartTime - this.clock.currentAudioTime;
		if (remainedTime <= 0) {
			cursor.finish();
			return;
		}

		this.#timeoutToken = setTimeout(this.#scheduleFinish, Math.max(2, remainedTime * 1000));
	}
}


class StopwatchCursor {

	constructor(
		task: MetronomeTaskImpl,
		private onFinished?: () => void,
	) {
		this.nextNoteCursor = new MetronomeCursor(task);
		this.currentNotePosition = this.lastNotePosition = {
			beatNoteIndex: -1,
			measureBeatIndex: -1,
			partIndex: -1,
			partMeasureIndex: -1,
			partStartTime: 0,
		};
	}

	readonly nextNoteCursor;
	currentNotePosition: MetronomePosition;
	lastNotePosition: MetronomePosition;
	#finishCompleted = false;

	advanceNoteBeforeClick() {
		this.currentNotePosition = this.lastNotePosition = this.nextNoteCursor.position;
		this.nextNoteCursor.advanceNote();
	}

	get finished() {
		return this.#finishCompleted;
	}

	finish() {
		this.#finishCompleted = true;
		this.currentNotePosition = this.nextNoteCursor.position;
		this.onFinished?.();
	};
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




