import type { MetronomeOptions, MetronomeTask, MetronomeTaskPart, MetronomeTaskPartDuration } from "../metronome";
import type { ExercisePartSettings, ExerciseSettings } from "./Exercise";


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

export function createMetronomeTask(params: ExerciseToMetronomeTaskParams, task: ExerciseMetronomeTask): MetronomeTask {
	return {
		parts: task.parts.map(p => createMetronomeTaskPart(params, p)),
	};
}


export function createMetronomeTaskPart(params: ExerciseToMetronomeTaskParams, part: ExerciseMetronomeTaskPart): MetronomeTaskPart {

	return { ...part, bpm: getBpm(params.baseBpm, part.bpmFormula) };

	function getBpm(baseBpm: number, f: BpmFormula | undefined): number {

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

		return duration.map((d, i) => ({
			name: createName(d.name, i),
			signature: parseBar(settings.bar) ?? fallbackPart.signature,
			beatDivider: parseDiv(settings.div) ?? fallbackPart.beatDivider,
			beatAccents: parseAccents(settings.accents) ?? fallbackPart.beatAccents,
			bpm: fallbackPart.bpm,
			bpmFormula: parseBpm(settings.bpm) ?? fallbackPart.bpmFormula,
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

	function parseBpm(bpm: ExercisePartSettings["bpm"]): BpmFormula | undefined {

		if (bpm === undefined) return undefined;

		if (typeof bpm === "number") {
			return { type: "=", value: bpm };
		}

		if (typeof bpm !== "string") {
			return fail();
		}

		bpm = bpm.trim();
		const op = bpm[0];
		const value = Number.parseFloat(bpm.substring(1));

		if (Number.isNaN(value)) {
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
			appendError?.(`invalid bpm formula: ${bpm}, expected constant number or string containing the operator character following by a number`);
			return undefined;
		}
	}

	function parseT(t: ExercisePartSettings["t"]): TaskPartT[] | undefined {

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

			result.push({ units, value, name });
		}

		return result;

		function fail(t: any) {
			appendError?.(`invalid duration time: ${t}, expected number of measures or {seconds}s or {minutes}m`);
			return undefined;
		}
	}

}


