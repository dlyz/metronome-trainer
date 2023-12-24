import { BasicEvent } from "../Event";
import { Exercise, ExerciseDto } from "./Exercise";
import { FormattedText } from "./FormattedText";


export interface ExercisePage {

	readonly pageId: string;

	readonly accessInfo?: ExercisePageAccessInfo;

	readonly exercise?: Exercise;

	readonly onChanged: BasicEvent;

	readonly contentScriptApi: ExercisePageContentScriptApi | undefined;

	refreshPage(): Promise<void>;

	createExercise(): Promise<void>;

	exportDto(): ExercisePageDto;
}

export interface ExercisePageAccessInfo {
	hasAccess: boolean,
	error?: FormattedText,
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
	accessInfo?: ExercisePageAccessInfo;
	exercise?: ExerciseDto;
}



