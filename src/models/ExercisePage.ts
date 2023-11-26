import { BasicEvent } from "../Event";
import { Exercise, ExerciseDto } from "./Exercise";


export interface ExercisePage {

	readonly pageId: string;

	readonly hasAccess?: boolean;

	readonly exercise?: Exercise;

	readonly onChanged: BasicEvent;

	readonly contentScriptApi: ExercisePageContentScriptApi | undefined;

	refreshPage(): Promise<void>;

	createExercise(): Promise<void>;

	exportDto(): ExercisePageDto;
}

export interface ExercisePageContentScriptApi {
	update(dto: ExercisePageDto): void;
	readonly hasNextExercise: boolean;
	toNextExercise(): void;
}

export type ExercisePageContentScriptApiFactory = (dto: ExercisePageDto) => ExercisePageContentScriptApi | undefined;


export interface ExercisePageDto {
	type: "exercisePage";
	pageId: string;
	sourceType: string;
	hasAccess?: boolean;
	exercise?: ExerciseDto;
}
