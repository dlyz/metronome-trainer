import _ from "lodash";


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


export interface MetronomeTask {
	parts: MetronomeTaskPart[],
}


export interface MetronomeTaskPart extends MetronomeOptions {
	name?: string,
	duration: MetronomeTaskPartDuration,
}

export interface MetronomeTaskPartDuration {
	units: "measures" | "seconds",
	value: number,
}


function getFullOptions(options: Partial<MetronomeOptions> | undefined): MetronomeOptions {
	return {
		bpm: 60,
		signature: [4, 4],
		beatAccents: { 0: 3 },
		beatDivider: 1,
		..._.omitBy(options, _.isUndefined),
	};
}


export interface MetronomePosition {
	partIndex: number,
	partMeasureIndex: number,
	measureBeatIndex: number,
	beatNoteIndex: number,
	partStartTime: number,
}



export interface ClickDescriptor extends MetronomePosition {
	accent: number,
}

export type ClickEventHandler = (descriptor: ClickDescriptor) => void;


