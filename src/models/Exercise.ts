import { MetronomeOptions } from "../metronome";
import { MetronomeDuration } from "../metronome/core";
import { BpmTableSpec, ExerciseBpmTable, ExerciseBpmTableDto, parseBpmTableSpec } from "./BpmTable";

export interface ExerciseTask {
	duration?: MetronomeDuration;
	metronomeOptions: Partial<MetronomeOptions>;
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



export interface ExerciseSourceDto {
	type: "notion",
	bpmDatabaseId?: string,
	settingsBlockId?: string,
}

export interface ExerciseDto {
	type: "exercise";
	source: ExerciseSourceDto,
	currentTask?: ExerciseTask,
	bpmTableSpec?: BpmTableSpec;
	bpmTable?: ExerciseBpmTableDto;
	errors?: string[];
}


export interface ExerciseSettings {
	bar?: string,
	t?: string | number,
	div?: number,
	accents?: number[],
	bpms?: string,
}



export function parseExerciseSettings(
	settings: ExerciseSettings,
	appendError?: (error: string) => void
): {
	metronomeOptions: Partial<MetronomeOptions>,
	duration?: MetronomeDuration,
	bpmTableSpec?: BpmTableSpec,
} {

	const metronomeOptions: Partial<MetronomeOptions> = {
		signature: parseBar(settings.bar),
		beatDivider: parseDiv(settings.div),
		beatAccents: parseAccents(settings.accents),
	};

	const duration = parseT(settings.t);

	const bpmTableSpec = parseBpmTableSpec(settings.bpms, error => appendError?.("BPM table spec: " + error))

	return { metronomeOptions, duration, bpmTableSpec };

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

	function parseT(t: ExerciseSettings["t"]): MetronomeDuration | undefined {

		if (t === undefined) return undefined;

		if (typeof t === "number") {

			if (Number.isNaN(t) || t < 1) {
				return fail();
			}

			return { type: "measures", value: t };

		} else if (typeof t !== 'string') {
			return fail();
		}

		let str = t.trim();

		let mul;
		if (str.endsWith('s') || str.endsWith('S')) {
			mul = 1;
		} else if (str.endsWith('m') || str.endsWith('M')) {
			mul = 60;
		} else {
			return fail();
		}

		str = str.substring(0, str.length - 1);

		let val = Number.parseFloat(str);
		val *= mul;

		if (Number.isNaN(val) || val < 0) {
			return fail();
		}

		return { type: "seconds", value: val, };

		function fail() {
			appendError?.(`invalid duration time: ${t}, expected number of measures or {seconds}s or {minutes}m`);
			return undefined;
		}
	}

}
