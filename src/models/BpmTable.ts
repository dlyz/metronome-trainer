
export interface ExerciseBpmTable {
	refill(spec: BpmTableSpec): Promise<void>;

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
	spec: string | undefined,
	appendError?: (error: string) => void
): BpmTableSpec | undefined {

	if (spec === undefined) return undefined;
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
			const itemsPerPage = Number.parseInt(instruction.substring(1), 10);
			if (!isNaturalNumber(itemsPerPage)) {
				appendError?.(`items per page should be a positive integer, but got ${itemsPerPageStr}`);
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

			const from = Number.parseInt(chunks[0], 10);
			if (!isNaturalNumber(from)) {
				return fail(`lower bound expected to be a natural number in instruction '${instruction}'`);
			}

			let to = from;
			if (len2 - len1 === 1) {
				to = Number.parseInt(chunks[1], 10);

				if (!isNaturalNumber(to)) {
					return fail(`upper bound expected to be a natural number in instruction '${instruction}'`);
				}

				if (to < from) {
					return fail(`upper bound expected to be greater or equal to the lower one in instruction '${instruction}'`);
				}
			}

			let step = 1;
			if (len1 === 2) {
				step = Number.parseInt(chunks[len2 - 1], 10);

				if (!isNaturalNumber(step)) {
					return fail(`step expected to be a natural number in instruction '${instruction}'`);
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

	function isNaturalNumber(val: number) {
		return Number.isSafeInteger(val) && val > 0;
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