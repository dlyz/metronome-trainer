import { BpmTableSpec, parseBpmTableSpec } from "./BpmTable";
import { ExerciseMetronomeTask, ExerciseTask, parseExerciseMetronomeTask } from "./ExerciseTask";




export interface Exercise {

	readonly sourceMetronomeTask: ExerciseMetronomeTask | undefined;
	readonly currentTask: ExerciseTask | undefined;

	readonly bpmTableSpec: BpmTableSpec | undefined;
	readonly bpmTable: ExerciseBpmTable | undefined;
	readonly errors: string[] | undefined;

	refresh(): Promise<void>;
	finishTask(task: ExerciseTask): Promise<void>;
	refillBpmTable(spec: BpmTableSpec, options?: { removeExcessCompleted?: boolean }): Promise<void>;

	exportDto(): ExerciseDto;
}

export interface ExerciseBpmTable {
}

export interface ExerciseDto {
	type: "exercise";
	sourceMetronomeTask?: ExerciseMetronomeTask;
	currentTask?: ExerciseTask,
	bpmTableSpec?: BpmTableSpec;
	bpmTable?: ExerciseBpmTable;
	errors?: string[];
}


export interface ExercisePartSettings {
	name?: string,
	bar?: string,
	t?: string | number,
	div?: number,
	accents?: number[] | string,
	bpm?: string | number,
}

export interface ExerciseSettings extends ExercisePartSettings {
	bpms?: string | number,
	parts?: ExercisePartSettings[],
}


export function parseExerciseSettings(
	settings: ExerciseSettings,
	appendError?: (error: string) => void
): {
	metronomeTask: ExerciseMetronomeTask,
	bpmTableSpec?: BpmTableSpec,
} {
	//console.log(settings);

	const metronomeTask = parseExerciseMetronomeTask(settings, appendError);
	const bpmTableSpec = parseBpmTableSpec(settings.bpms, error => appendError?.("bpms: " + error))

	return { metronomeTask, bpmTableSpec };
}
