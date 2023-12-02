import type { MetronomeOptions, MetronomeTask, MetronomeTaskPart, MetronomeTaskPartDuration } from "../metronome";
import type { ExercisePartSettings, ExerciseSettings } from "./Exercise";
import { checkFloat, checkInt, checkBpmValue, bpmLimits, roundFinalBpm, coerceBpm } from "./validation";


export interface ExerciseTask {
	baseBpm: number;
	sourceMetronomeTask: ExerciseMetronomeTask;
	metronomeTask: MetronomeTask;
}

export interface ExerciseMetronomeTask extends MetronomeTask {
	parts: ExerciseMetronomeTaskPart[],
}

export interface ExerciseMetronomeTaskPart extends MetronomeTaskPart {
	bpmFormula?: BpmFormula,
}

interface BpmBinaryOperation<TOperator> {
	type: TOperator,
	right: number,
}

export type BpmFormula = never
| { type: "=", value: number, }
| BpmBinaryOperation<"+">
| BpmBinaryOperation<"-">
| BpmBinaryOperation<"*">
| BpmBinaryOperation<"/">
;


export interface ExerciseToMetronomeTaskParams {
	baseBpm: number,
}

export function createExerciseTask(
	params: { baseBpm: number, sourceMetronomeTask: ExerciseMetronomeTask },
	appendError?: (error: string) => void
): ExerciseTask {
	let baseBpm: number;
	if (!checkBpmValue(params.baseBpm)) {
		appendError?.(`task base bpm ${params.baseBpm} is invalid: expected number [${bpmLimits.min}, ${bpmLimits.max}]`);
		baseBpm = bpmLimits.default;
	} else {
		baseBpm = roundFinalBpm(params.baseBpm);
	}

	return {
		baseBpm,
		sourceMetronomeTask: params.sourceMetronomeTask,
		metronomeTask: createMetronomeTask({ baseBpm }, params.sourceMetronomeTask, appendError),
	}
}

export function createMetronomeTask(
	params: ExerciseToMetronomeTaskParams,
	task: ExerciseMetronomeTask,
	appendError?: (error: string) => void
): MetronomeTask {
	return {
		parts: task.parts.map((p, i) => createMetronomeTaskPart(i, params, p, appendError)),
	};
}


export function createMetronomeTaskPart(
	index: number,
	params: ExerciseToMetronomeTaskParams,
	part: ExerciseMetronomeTaskPart,
	appendError?: (error: string) => void
): MetronomeTaskPart {

	return { ...part, bpm: getBpm(params.baseBpm, part.bpmFormula) };

	function getBpm(baseBpm: number, f: BpmFormula | undefined): number {
		const bpm = getRawBpm(baseBpm, f);
		if (!checkBpmValue(bpm)) {
			const coercedBpm = coerceBpm(bpm);
			appendError?.(`evaluated task part ${index + 1} bpm ${bpm} is invalid and will be replaced with ${coercedBpm}: expected number [${bpmLimits.min}, ${bpmLimits.max}]`);
			return coercedBpm;
		} else {
			return roundFinalBpm(bpm);
		}
	}

	function getRawBpm(baseBpm: number, f: BpmFormula | undefined): number {

		if (!f) {
			return baseBpm;
		} else {
			// todo: validate results
			switch (f.type) {
				case "=": return f.value;
				case "+": return baseBpm + f.right;
				case "-": return baseBpm - f.right;
				case "*": return baseBpm * f.right;
				case "/": return baseBpm / f.right;
				default: {
					const exhaustiveCheck: never = f;
					throw new Error(`unsupported bpm formula type: ${(f as any)?.type}`);
				}
			}
		}
	}
}


type TaskPartT = MetronomeTaskPartDuration & { name?: string };

export function parseExerciseMetronomeTask(
	settings: ExerciseSettings,
	appendError?: (error: string) => void
): ExerciseMetronomeTask {

	const defaultPart: Omit<ExerciseMetronomeTaskPart, "duration"> = {
		bpm: 0,
		signature: [4, 4],
		beatAccents: { 0: 3 },
		beatDivider: 1,
		bpmFormula: undefined,
	};

	const defaultDuration: TaskPartT[] = [{ units: "seconds", value: 60 }];

	const partsFromRoot = parseTaskPart(settings, defaultPart, defaultDuration);
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
						return parseTaskPart(p, fallbackPart, fallbackDuration);
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
		fallbackPart: Omit<ExerciseMetronomeTaskPart, "duration">,
		fallbackDuration: TaskPartT[]
	): ExerciseMetronomeTaskPart[] {

		let duration = parseT(settings.t);
		if (!duration || duration.length === 0) {
			duration = fallbackDuration;
		}

		const baseName = settings.name || fallbackPart.name;

		function createName(tName: string | undefined, tIndex: number) {
			if (!baseName) return tName;
			else if (!tName) {
				if (!baseName) return undefined;
				if (duration!.length === 1) return baseName;
				return baseName + " " + (tIndex+1);
			} else {
				return baseName + " " + tName;
			}
		}

		const proto: ExerciseMetronomeTaskPart = {
			signature: parseBar(settings.bar) ?? fallbackPart.signature,
			beatDivider: parseDiv(settings.div) ?? fallbackPart.beatDivider,
			beatAccents: parseAccents(settings.accents) ?? fallbackPart.beatAccents,
			bpm: fallbackPart.bpm,
			bpmFormula: parseBpm(settings.bpm) ?? fallbackPart.bpmFormula,
			duration: undefined!,
		}

		return duration.map((d, i) => ({
			...proto,
			name: createName(d.name, i),
			duration: d,
		}));
	}

	function parseBar(bar: string | undefined): [number, number] | undefined {

		if (bar === undefined) return undefined;
		else if (typeof bar !== 'string') return fail();

		const barParts = bar.trim().split('/');

		if (barParts.length !== 2) return fail();

		const num = Number.parseFloat(barParts[0]);
		const denum = Number.parseFloat(barParts[1]);

		const maxValue = 128;

		if (!checkInt(num, 1, maxValue) || !checkInt(denum, 1, maxValue)) return fail();

		return [num, denum];

		function fail() {
			appendError?.(`bar: ${bar}: invalid time signature, expected '{numerator}/{denominator}' with integers [1-${maxValue}]`);
			return undefined;
		}
	}

	function parseDiv(div: number | undefined) {
		if (div === undefined) return undefined;
		else if (typeof div !== 'number') return fail();

		const maxValue = 128;
		if (!checkInt(div, 1, maxValue)) return fail();

		return div;

		function fail() {
			appendError?.(`div: ${div}: invalid beat divider, expected integer [1-${maxValue}]`);
			return undefined;
		}
	}

	function parseAccents(accents: number[] | undefined) {

		if (accents === undefined) return undefined;
		else if (!Array.isArray(accents)) return fail();
		for (const value of accents) {
			if (!checkInt(value, 0, 3)) {
				return fail();
			}
		}

		return accents as Partial<Record<number, 0 | 1 | 2 | 3>>;

		function fail() {
			appendError?.(`accents: ${accents?.join(", ")}: invalid accents array, expected array of integers [0-3]`);
			return undefined;
		}

	}

	function parseBpm(bpm: ExercisePartSettings["bpm"]): BpmFormula | undefined {

		if (bpm === undefined) return undefined;



		if (typeof bpm === "number") {

			if (!checkBpmValue(bpm)) {
				return fail();
			}

			return { type: "=", value: bpm };
		}

		if (typeof bpm !== "string") {
			return fail();
		}

		bpm = bpm.trim();
		const op = bpm[0];
		const value = Number.parseFloat(bpm.substring(1));

		if (!checkBpmValue(value)) {
			return fail();
		}

		switch(op) {
			case "=": return { type: "=", value };
			case "+": return { type: "+", right: value };
			case "-": return { type: "-", right: value };
			case "*": return { type: "*", right: value };
			case "/": return { type: "/", right: value };
			default: {
				appendError?.(`invalid bpm formula: ${bpm}: operator '${op}' not supported`);
				return undefined;
			}
		}

		function fail() {
			appendError?.(`bpm: ${bpm}: invalid bpm formula, expected constant number or string containing the operator character '+-*/=' following by a number [${bpmLimits.min}, ${bpmLimits.max}]`);
			return undefined;
		}
	}

	function parseT(t: ExercisePartSettings["t"]): TaskPartT[] | undefined {

		if (t === undefined) return undefined;

		const maxValue = 10800;

		if (typeof t === "number") {

			if (!checkInt(t, 1, maxValue)) {
				return fail(t);
			}

			return [{ units: "measures", value: t }];

		} else if (Array.isArray(t)) {
			return t.flatMap(chunk => parseT(chunk) ?? []);
		} else if (typeof t !== 'string') {
			return fail(t);
		}

		const chunks = t.split(',');
		const result: TaskPartT[] = [];

		for (const chunk of chunks) {

			let str = chunk.trim();
			if (!str) continue;

			let name;
			const nameSeparatorIndex = str.lastIndexOf('/');
			if (nameSeparatorIndex !== -1) {
				name = str.substring(0, nameSeparatorIndex).trim() || undefined;
				str = str.substring(nameSeparatorIndex + 1).trim();
			}

			let secondsMul;
			if (str.endsWith('s') || str.endsWith('S')) {
				secondsMul = 1;
				str = str.substring(0, str.length - 1);
			} else if (str.endsWith('m') || str.endsWith('M')) {
				secondsMul = 60;
				str = str.substring(0, str.length - 1);
			}


			let value = Number.parseFloat(str);

			let units: MetronomeTaskPartDuration["units"];
			if (secondsMul !== undefined) {
				if (!checkFloat(value, 0, maxValue, true)) return fail(chunk);
				value *= secondsMul;
				if (!checkFloat(value, 0, maxValue, true)) return fail(chunk);
				units = "seconds";
			} else {
				if (!checkInt(value, 1, maxValue)) return fail(chunk);
				units = "measures";
			}

			result.push({ units, value, name });
		}

		return result;

		function fail(t: any) {
			appendError?.(`t: ${t}: invalid duration time, expected number of measures or {seconds}s or {minutes}m in range (0, ${maxValue}] measures/seconds`);
			return undefined;
		}
	}


}


