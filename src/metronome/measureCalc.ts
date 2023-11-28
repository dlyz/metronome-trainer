import { BeatAccentsMap, MetronomeOptions, MetronomePosition, MetronomeTask, MetronomeTaskPart } from "./core";



export interface MetronomeMeasureConfig {

	readonly beatsCount: number;
	readonly duration: number;
	readonly beatDuration: number;
	readonly beatDivider: number;
	readonly noteInterval: number;
	readonly beatNotesShifts: number[];
	readonly beatAccents: BeatAccentsMap;
}


export function getMeasureConfig(options: MetronomeOptions): MetronomeMeasureConfig {
	const { signature, bpm, beatDivider } = options;

	const beatsCount = signature[0];
	const bps = bpm / 60;
	const beatDuration = 1 / bps;

	let duration = 0;
	for (let index = 0; index < beatsCount; index++, duration += beatDuration) {
	}

	const beatNotesShifts = [0];
	const noteDuration = beatDuration / beatDivider;
	for (let index = 1; index < beatDivider; ++index) {
		beatNotesShifts.push(beatNotesShifts[index - 1] + noteDuration);
	}

	return {
		beatsCount,
		duration,
		beatDuration,
		beatDivider,
		beatNotesShifts,
		noteInterval: beatDuration / beatDivider,
		beatAccents: options.beatAccents,
	};
}


export class MetronomeTaskImpl {
	constructor(readonly task: MetronomeTask) {
		this.parts = task.parts.map(p => new MetronomeTaskPartImpl(p));
	}

	readonly parts;
}

export class MetronomeTaskPartImpl {

	constructor(readonly part: MetronomeTaskPart) {
		this.measure = getMeasureConfig(part);

		const duration = part.duration;
		if (duration.units === 'measures') {

			if (duration.value < 1) {
				throw new Error(`can not create metronome task part with less than one measure. provided: ${duration.value}`);
			}

			this.measureCount = Math.floor(duration.value);

		} else if (duration.units === 'seconds') {

			if (duration.value < 0) {
				throw new Error(`can not create etronome task part with negative duration. provided: ${duration.value}`);
			}

			this.measureCount = Math.max(1, Math.ceil(duration.value/this.measure.duration));
		} else {
			throw new Error(`unsupported metronome duration units '${duration.units}'`);
		}
	}

	readonly measureCount;
	readonly measure: MetronomeMeasureConfig;
}



export class MetronomeCursor {
	constructor(
		readonly task: MetronomeTaskImpl
	) {
		this
	}

	partIndex = 0;
	partMeasureIndex = 0;
	measureBeatIndex = 0;
	beatNoteIndex = 0;

	measureStartTime = 0;
	partStartTime = 0;

	get beatStartTime() {
		return this.measureStartTime + this.measureBeatIndex * this.part.measure.beatDuration;
	}

	get noteStartTime() {
		return this.beatStartTime + this.part.measure.beatNotesShifts[this.beatNoteIndex];
	}

	get part() { return this.task.parts[this.partIndex]; }
	get remainedPartMeasures() { return this.task.parts[this.partIndex].measureCount - this.partMeasureIndex; }
	get finished() { return this.partIndex === this.task.parts.length; }

	get position(): MetronomePosition {
		return {
			partIndex: this.partIndex,
			partMeasureIndex: this.partMeasureIndex,
			measureBeatIndex: this.measureBeatIndex,
			beatNoteIndex: this.beatNoteIndex,
		};
	}

	advanceMeasure() {
		const part = this.part;
		const measure = part.measure;

		this.measureStartTime += measure.duration;

		if (++this.partMeasureIndex === part.measureCount) {
			this.partMeasureIndex = 0;
			++this.partIndex;
			this.partStartTime = this.measureStartTime;
		}

		this.measureBeatIndex = this.beatNoteIndex = 0;
	}

	advanceBeat() {
		const part = this.part;
		const measure = part.measure;

		if (++this.measureBeatIndex === measure.beatsCount) {
			this.advanceMeasure();
		} else {
			this.beatNoteIndex = 0;
		}
	}


	advanceNote() {
		const part = this.part;
		const measure = part.measure;

		if (++this.beatNoteIndex === measure.beatDivider) {
			this.advanceBeat();
		}
	}
}
