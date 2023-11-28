import { ClickEventHandler, MetronomePosition, MetronomeTask } from "./core";
import { MetronomeStopwatch } from "./stopwatch";
import { StartShiftedPlayer, createSimplePlayer } from "./Player";
import { NoteScheduler } from "./NoteScheduler";
import { MetronomeTaskImpl } from "./measureCalc";

export * from "./core";


export class Metronome {

	#scheduler?: NoteScheduler;
	#stopwatch?: MetronomeStopwatch;
	#onFinished?: () => void;


	restart(
		task: MetronomeTask,
		clickEventHandler?: ClickEventHandler,
		onFinished?: () => void,
	) {
		this.stop();

		const taskImpl = new MetronomeTaskImpl(task);

		this.#onFinished = onFinished;
		const player = createSimplePlayer();
		this.#stopwatch = new MetronomeStopwatch(
			player,
			taskImpl,
			clickEventHandler,
			this.#onTimerFinished,
		);

		this.#scheduler = new NoteScheduler(player, taskImpl);

		this.#setIsPlaying(true);
	}

	stop() {
		this.#onFinished = undefined;
		this.#setIsPlaying(false);

		this.#scheduler?.close();
		this.#scheduler = undefined;
		this.#stopwatch?.close();
		this.#stopwatch = undefined;
	}


	pause() {
		if (!this.#isPlaying) return;
		this.#scheduler?.suspend();
		this.#stopwatch?.suspend();
		this.#setIsPlaying(false);
	}

	resume() {
		if (this.#isPlaying) return;

		// stopped, can not resume
		if (!this.#stopwatch) return false;

		if (this.#stopwatch.finished) {
			this.restart(
				this.#stopwatch.task.task,
				this.#stopwatch.clickHandler,
				this.#onFinished
			);
			return true;
		}

		this.#stopwatch.resume();
		this.#scheduler!.resume();
		this.#setIsPlaying(true);

		return true;
	}


	#isPlaying = false;
	#displayWakeLock?: Promise<WakeLockSentinel>;

	#setIsPlaying(value: boolean) {
		this.#isPlaying = value;
		if (value) {
			// temp solution. ideally this should be an option,
			// and the sound should continue during the display sleep, but for now we do not schedule whole task
			// and we rely on js timer witch require display to function.
			// also after wakeup background worker is reloaded and completed task may be lost
			this.#displayWakeLock = navigator.wakeLock?.request("screen");
		} else {
			this.#displayWakeLock?.then(l => l.release());
			this.#displayWakeLock = undefined;
		}
	}

	#onTimerFinished = () => {
		this.pause();
		this.#onFinished?.();
	}


	get partElapsedSeconds() {
		const sw = this.#stopwatch;
		if (!sw) return 0;
		return sw.clock.currentAudioTime - sw.taskCursor.partStartTime;
	}

	get position(): MetronomePosition {
		return this.#stopwatch?.taskCursor.position
			?? { partMeasureIndex: 0, beatNoteIndex: 0, measureBeatIndex: 0, partIndex: 0 };
	}
}


