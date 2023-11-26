import { MetronomeMeasureConfig, MetronomeStopwatch } from "./stopwatch";
import { Player } from "./Player";

export class NoteScheduler {

	readonly #intervalToken: number;
	#nextMeasureToScheduleAudioTime: number;
	#chunkRemainedMeasures?: number;
	#chunksQueue: number[];

	readonly #displayWakeLock;

	constructor(
		readonly measureConfig: MetronomeMeasureConfig,
		readonly player: Player,
		readonly stopwatch: MetronomeStopwatch
	) {
		this.#nextMeasureToScheduleAudioTime = this.player.currentAudioTime + 0.1;

		const chunks = stopwatch.resume(player, this.#nextMeasureToScheduleAudioTime, this.measureConfig);
		this.#chunksQueue = chunks?.measures ?? [];
		if (chunks) {
			this.#chunkRemainedMeasures = this.#chunksQueue.shift() ?? 0;
		}
		this.#intervalToken = setInterval(this.#onIntervalCallback, NoteScheduler.#workerIntervalS * 1000);
		this.#onIntervalCallback();


		// temp solution. ideally this should be an option,
		// and the sound should continue during the display sleep, but for now we do not schedule whole task
		// and we rely on js timer witch require display to function.
		// also after wakeup background worker is reloaded and completed task may be lost
		this.#displayWakeLock = navigator.wakeLock?.request("screen");
	}

	close() {
		this.#displayWakeLock?.then(l => l.release());
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
	};

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
