

export function checkInt(value: number, min: number, max: number) {
	return Number.isSafeInteger(value) && value >= min && value <= max;
}

export function coerceInt(value: number, min: number, max: number, def: number) {
	if (Number.isNaN(value)) return def;
	return Math.max(min, Math.min(max, value));
}


export function checkFloat(value: number, min: number, max: number, minStrict: boolean = false, maxStrict: boolean = false) {
	return typeof value === 'number' && !Number.isNaN(value) && (minStrict ? (value > min) : (value >= min)) && (maxStrict ? (value < max) : (value <= max));
}

export const bpmLimits = {
	min: 0.1,
	max: 360,
	default: 60,
}

export function checkBpmValue(value: number) {
	return checkFloat(value, bpmLimits.min, bpmLimits.max);
}

export function roundFinalBpm(value: number) {
	return Math.round(value * 10) / 10;
}

export function coerceBpm(value: number) {
	if (Number.isNaN(value)) return roundFinalBpm(bpmLimits.default);
	value = roundFinalBpm(value);
	if (value < bpmLimits.min) return roundFinalBpm(bpmLimits.min);
	if (value > bpmLimits.max) return roundFinalBpm(bpmLimits.max);
	return value;
}
