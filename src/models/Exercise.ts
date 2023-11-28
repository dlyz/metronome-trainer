import { MetronomeOptions } from "../metronome";
import { MetronomeTask, MetronomeTaskPart, MetronomeTaskPartDuration } from "../metronome/core";
import { BpmTableSpec, ExerciseBpmTable, ExerciseBpmTableDto, parseBpmTableSpec } from "./BpmTable";

export interface ExerciseTask {
	baseBpm: number,
	metronomeTask: MetronomeTask;
}

export interface Exercise {

	readonly currentTask?: ExerciseTask;

	readonly bpmTableSpec?: BpmTableSpec;
	readonly bpmTable?: ExerciseBpmTable;
	readonly errors?: string[];

	refreshTask(): Promise<void>;
	finishTask(task: ExerciseTask): Promise<void>;

	exportDto(): ExerciseDto;
}


export interface ExerciseDto {
	type: "exercise";
	currentTask?: ExerciseTask,
	bpmTableSpec?: BpmTableSpec;
	bpmTable?: ExerciseBpmTableDto;
	errors?: string[];
}


export interface ExercisePartSettings {
	name?: string,
	bar?: string,
	t?: string | number,
	div?: number,
	accents?: number[],
}

export interface ExerciseSettings extends ExercisePartSettings {
	bpms?: string,
	parts?: ExercisePartSettings[],
}


export function parseExerciseSettings(
	settings: ExerciseSettings,
	appendError?: (error: string) => void
): {
	metronomeTask: MetronomeTask,
	bpmTableSpec?: BpmTableSpec,
} {
	//console.log(settings);

	const metronomeTask = parseMetronomeTask(settings, appendError);
	const bpmTableSpec = parseBpmTableSpec(settings.bpms, error => appendError?.("BPM table spec: " + error))

	return { metronomeTask, bpmTableSpec };
}


export function applyBaseBpm(baseBpm: number, task: MetronomeTask): MetronomeTask {
	return {
		parts: task.parts.map(p => ({ ...p, bpm: baseBpm })),
	};
}

export function parseMetronomeTask(
	settings: ExerciseSettings,
	appendError?: (error: string) => void
): MetronomeTask {

	const defaultOptions: MetronomeOptions = {
		bpm: 0,
		signature: [4, 4],
		beatAccents: { 0: 3 },
		beatDivider: 1,
	};

	const defaultDuration: MetronomeTaskPartDuration[] = [{ units: "seconds", value: 60 }];

	const partsFromRoot = parseTaskPart(settings, undefined, defaultOptions, defaultDuration);
	// assert partsFromRoot.length > 0

	if (settings.parts) {
		if (Array.isArray(settings.parts) && settings.parts.length > 0) {
			const fallbackPart = partsFromRoot[0];
			const fallbackDuration = partsFromRoot.map(p => p.duration);
			const parts = settings.parts
				.flatMap(p => {
					if (p == undefined) {
						return [];
					} else if (typeof p !== "object") {
						appendError?.(`item of 'parts' should be an object, but got ${typeof p}.`);
						return [];
					} else {
						return parseTaskPart(p, fallbackPart.name, fallbackPart, fallbackDuration);
					}
				})
			;

			if (parts.length !== 0) {
				return { parts };
			} else {
				appendError?.("could not find any 'parts'");
			}

		} else {
			appendError?.("'parts' should be a non-empty array of part settings.");
		}
	}

	return {
		parts: partsFromRoot,
	};

	function parseTaskPart(
		settings: ExercisePartSettings,
		fallbackName: string | undefined,
		fallbackOptions: MetronomeOptions,
		fallbackDuration: MetronomeTaskPartDuration[]
	): MetronomeTaskPart[] {

		const metronomeOptions: MetronomeOptions = {
			signature: parseBar(settings.bar) ?? fallbackOptions.signature,
			beatDivider: parseDiv(settings.div) ?? fallbackOptions.beatDivider,
			beatAccents: parseAccents(settings.accents) ?? fallbackOptions.beatAccents,
			bpm: fallbackOptions.bpm,
		};

		let duration = parseT(settings.t);
		if (!duration || duration.length === 0) {
			duration = fallbackDuration;
		}

		const name = settings.name || fallbackName;

		return duration.map((d, i) => ({
			name: duration!.length === 1 ? name : name ? (name + " " + (i+1)) : undefined,
			...metronomeOptions,
			duration: d,
		}));
	}

	function parseBar(bar: string | undefined): [number, number] | undefined {

		if (bar === undefined) return undefined;
		else if (typeof bar !== 'string') return fail();

		const barParts = bar.trim().split('/');

		if (barParts.length !== 2) return fail();

		const num = Number.parseInt(barParts[0], 10);
		const denum = Number.parseInt(barParts[1], 10);

		if (Number.isNaN(num) || Number.isNaN(denum) || num < 1 || denum < 1) return fail();

		return [num, denum];

		function fail() {
			appendError?.(`invalid bar time signature: ${bar}, expected {numerator}/{denominator} with positive integers`);
			return undefined;
		}
	}

	function parseDiv(div: number | undefined) {
		if (div === undefined) return undefined;
		else if (typeof div !== 'number') return fail();

		if (Number.isNaN(div) || !Number.isSafeInteger(div) || div < 1) return fail();

		return div;

		function fail() {
			appendError?.(`invalid beat divider: ${div}, expected positive integer`);
			return undefined;
		}
	}


	function parseAccents(accents: number[] | undefined) {

		if (accents === undefined) return undefined;
		else if (!Array.isArray(accents)) return fail();

		return accents as Partial<Record<number, 0 | 1 | 2 | 3>>;

		function fail() {
			appendError?.(`invalid accents array: ${accents}, expected array of integers`);
			return undefined;
		}

	}

	function parseT(t: ExerciseSettings["t"]): MetronomeTaskPartDuration[] | undefined {

		if (t === undefined) return undefined;

		if (typeof t === "number") {

			if (Number.isNaN(t) || t <= 0) {
				return fail(t);
			}

			return [{ units: "measures", value: t }];

		} else if (Array.isArray(t)) {
			return t.flatMap(chunk => parseT(chunk) ?? []);
		} else if (typeof t !== 'string') {
			return fail(t);
		}

		const chunks = t.split(',');
		const result: MetronomeTaskPartDuration[] = [];

		for (const chunk of chunks) {

			let str = chunk.trim();

			let secondsMul;
			if (str.endsWith('s') || str.endsWith('S')) {
				secondsMul = 1;
				str = str.substring(0, str.length - 1);
			} else if (str.endsWith('m') || str.endsWith('M')) {
				secondsMul = 60;
				str = str.substring(0, str.length - 1);
			}


			let value = Number.parseFloat(str);
			if (Number.isNaN(value) || value <= 0) {
				return fail(chunk);
			}

			let units: MetronomeTaskPartDuration["units"];
			if (secondsMul !== undefined) {
				value *= secondsMul;
				units = "seconds";
			} else {
				units = "measures";
			}

			result.push({ units, value });
		}

		return result;

		function fail(t: any) {
			appendError?.(`invalid duration time: ${t}, expected number of measures or {seconds}s or {minutes}m`);
			return undefined;
		}
	}

}

