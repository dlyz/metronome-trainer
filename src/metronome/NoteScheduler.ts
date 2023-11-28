import { Player } from "./Player";
import { MetronomeMeasureConfig, MetronomeCursor, MetronomeTaskImpl } from "./measureCalc";

export class NoteScheduler {

	#intervalToken = 0;
	#taskCursor;

	#lastScheduledNoteStartTime = 0;
	#lastScheduledNoteFinishTime = 0;

	constructor(
		readonly player: Player,
		readonly task: MetronomeTaskImpl,
	) {
		this.#taskCursor = new MetronomeCursor(task);
		this.resume();
	}

	#suspendTimeoutToken?: number;

	suspend() {
		const player = this.player;
		this.#suspendTimeoutToken = this.#doAfterCurrentNoteFinish(() => player.suspend());
		clearInterval(this.#intervalToken);
	}

	resume() {
		clearTimeout(this.#suspendTimeoutToken);
		this.player.resume();
		this.#intervalToken = setInterval(this.#onIntervalCallback, NoteScheduler.#workerIntervalS * 1000);
		this.#onIntervalCallback();
	}

	close() {
		clearInterval(this.#intervalToken);

		const player = this.player;
		this.#doAfterCurrentNoteFinish(() => player.close());
	}

	#doAfterCurrentNoteFinish(action: () => void) {

		const time = this.player.currentAudioTime;
		const eps = 0.005;
		if (time >= this.#lastScheduledNoteStartTime - eps && time < this.#lastScheduledNoteFinishTime + eps) {
			// letting the last note to complete playing
			return setTimeout(() => {
				action();
			}, (this.#lastScheduledNoteFinishTime + eps - time) * 1000);
		} else {
			action();
			return undefined;
		}
	}

	static readonly #workerIntervalS = 7;
	static readonly #prescheduledIntervalS = 7 * 2.5;

	#onIntervalCallback = () => {

		const currentTime = this.player.currentAudioTime;
		const scheduleUntil = currentTime + NoteScheduler.#prescheduledIntervalS;
		const cursor = this.#taskCursor;

		if (cursor.finished) {
			clearInterval(this.#intervalToken);
			return;
		}

		while (cursor.measureStartTime < scheduleUntil) {

			const partRemainedMeasuresBeforeCurrent = (cursor.partMeasureIndex === 0 && cursor.partIndex !== 0) ? 0 : cursor.remainedPartMeasures;

			this.#scheduleMeasure(
				cursor.part.measure,
				cursor.measureStartTime,
				partRemainedMeasuresBeforeCurrent
			);

			cursor.advanceMeasure();
			if (cursor.finished) {
				this.#scheduleTransition(cursor.measureStartTime, 0);
				clearInterval(this.#intervalToken);
				return;
			}

		}
	};

	#scheduleMeasure(
		measureConfig: MetronomeMeasureConfig,
		startTime: number,
		partRemainedMeasuresBeforeCurrent: number | undefined
	): void {

		const { beatsCount, beatDuration, beatAccents, beatNotesShifts } = measureConfig;

		let time = startTime;

		let skipFirstBeatNote = this.#scheduleTransition(time, partRemainedMeasuresBeforeCurrent);
		for (let index = 0; index < beatsCount; index++, time += beatDuration) {

			const accent = beatAccents[index] ?? 1;
			if (accent !== 0) {
				if (!skipFirstBeatNote) {
					this.#lastScheduledNoteStartTime = time + beatNotesShifts[0]
					this.#scheduleClick(time + beatNotesShifts[0], accent);
				}
				for (let noteIndex = 1; noteIndex < beatNotesShifts.length; ++noteIndex) {
					this.#scheduleClick(time + beatNotesShifts[noteIndex], 1);
				}
			}

			skipFirstBeatNote = false;
		}
	}

	#scheduleClick(time: number, accent: 1 | 2 | 3) {
		this.#lastScheduledNoteStartTime = time;
		this.#lastScheduledNoteFinishTime = this.player.scheduleClick(time, accent);
	}

	#scheduleTransition(time: number, partRemainedMeasuresBeforeCurrent: number | undefined): boolean {

		this.#lastScheduledNoteStartTime = time;

		if (partRemainedMeasuresBeforeCurrent === 1) {
			this.#lastScheduledNoteFinishTime = this.player.scheduleTransition(time, 2);
			return true;
		} else if (partRemainedMeasuresBeforeCurrent === 0) {
			this.#lastScheduledNoteFinishTime = this.player.scheduleTransition(time, 1);
			return true;
		} else {
			return false;
		}
	}
}
