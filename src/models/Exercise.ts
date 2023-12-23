import { BpmTableSpec, ExerciseBpmTable, ExerciseBpmTableDto, parseBpmTableSpec } from "./BpmTable";
import { ExerciseMetronomeTask, ExerciseTask, parseExerciseMetronomeTask } from "./ExerciseTask";


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
