import { bpmLimits, checkBpmValue, checkInt } from "./validation";

export interface ExerciseBpmTable {
	refill(spec: BpmTableSpec, options?: { removeExcessCompleted?: boolean }): Promise<void>;

	exportDto(): ExerciseBpmTableDto;
}

export interface ExerciseBpmTableDto {
	type: "exerciseBpmTable";
}


export interface BpmTableSpec {
	groups: BpmTableChunkGroupSpec[],
}


export interface BpmTableChunkGroupSpec {
	chunks: BpmTableChunkSpec[],
	itemsPerPage?: number,
}

export interface BpmTableChunkSpec {
	from: number,
	to: number,
	step: number,
}


export function generateItemsBySpec(spec: BpmTableSpec) {
	const items: number[] = [];
	for (const group of spec.groups) {
		for (const chunk of group.chunks) {
			for (let i = chunk.from; i <= chunk.to; i += chunk.step) {
				items.push(i);
			}
		}
	}

	return items;
}


export function parseBpmTableSpec(
	spec: string | number | undefined,
	appendError?: (error: string) => void
): BpmTableSpec | undefined {

	if (spec === undefined) return undefined;

	if (typeof spec === 'number') {
		spec = "" + spec;
	}
	if (typeof spec !== 'string') {
		return fail(`string expected as a BPM table specification, but got ${typeof spec}`);
	}


	const instructions = spec.split(',').map(v => v.trim());
	const groups: BpmTableChunkGroupSpec[] = [];
	let currentGroup: BpmTableChunkGroupSpec = { chunks: [] };
	let lastChunk;

	for (const instruction of instructions) {

		if (/^\s*$/.test(instruction)) {

		} else if (instruction.startsWith('p') || instruction.startsWith('P')) {
			prepareForGroupPropChange();

			const itemsPerPageStr = instruction.substring(1);
			const itemsPerPage = Number.parseFloat(instruction.substring(1));
			if (!checkInt(itemsPerPage, 1, 1000000)) {
				appendError?.(`items per page should be an integer [1, 1000000], but got ${itemsPerPageStr}`);
			} else {
				currentGroup.itemsPerPage = itemsPerPage;
			}
		} else {


			let chunks = instruction.split('/');
			const len1 = chunks.length;
			if (len1 > 2) {
				return fail(`multiple steps ('/') are not expected in the single instruction '${instruction}'`);
			}

			chunks.splice(0, 1, ...chunks[0].split('-'));
			const len2 = chunks.length;

			if (len2 - len1 > 1) {
				return fail(`multiple ranges ('-') are not expected in the single instruction '${instruction}'`);
			}

			const from = Number.parseFloat(chunks[0]);
			if (!checkBpmValue(from)) {
				return fail(`lower bound expected to be a number [${bpmLimits.min}, ${bpmLimits.max}] in instruction '${instruction}'`);
			}

			let to = from;
			if (len2 - len1 === 1) {
				to = Number.parseFloat(chunks[1]);

				if (!checkBpmValue(to)) {
					return fail(`upper bound expected to be a number [${bpmLimits.min}, ${bpmLimits.max}] in instruction '${instruction}'`);
				}

				if (to < from) {
					return fail(`upper bound expected to be greater or equal to the lower one in instruction '${instruction}'`);
				}
			}

			let step = 1;
			if (len1 === 2) {
				step = Number.parseFloat(chunks[len2 - 1]);

				if (!checkBpmValue(step)) {
					return fail(`step expected to be a number [${bpmLimits.min}, ${bpmLimits.max}] in instruction '${instruction}'`);
				}
			}

			// bound becomes exclusive if the following chunk starts with it (for convenience).
			if (lastChunk && lastChunk.to === from) {
				--lastChunk.to;
			}

			lastChunk = {
				from,
				to,
				step,
			};

			currentGroup.chunks.push(lastChunk);
		}
	}

	function prepareForGroupPropChange() {
		if (currentGroup.chunks.length !== 0) {
			groups.push(currentGroup);
			currentGroup = { chunks: [] };
		}
	}

	if (currentGroup.chunks.length) {
		groups.push(currentGroup);
	}

	return { groups };

	function fail(cause: string) {
		appendError?.(cause);
		return undefined;
	}

}
