import { BasicEvent } from "../primitives/Event";
import { Exercise, ExerciseDto } from "./Exercise";
import { FormattedText } from "./FormattedText";


export interface ExercisePage {

	readonly pageId: string;

	readonly pageInfo?: ExercisePageInfo;

	readonly exercise?: Exercise;

	readonly onChanged: BasicEvent;

	readonly contentScriptApi: ExercisePageContentScriptApi | undefined;

	refresh(): Promise<void>;

	createExercise(): Promise<void>;

	exportDto(): ExercisePageDto;
}

export interface ExercisePageInfo {
	hasAccess: boolean,
	error?: FormattedText,
}

export interface ExercisePageDto {
	type: "exercisePage";
	pageId: string;
	sourceType: string;
	pageInfo?: ExercisePageInfo;
	exercise?: ExerciseDto;
}


export interface ExercisePageContentScriptApi {
	readonly hasNextExercise: boolean;
	toNextExercise(): void;
}


export type ExercisePageContentScriptApiFactory = (dto: ExercisePageDto) => ExercisePageContentScriptApiUpdater | undefined;

export interface ExercisePageContentScriptApiUpdater extends ExercisePageContentScriptApi {
	update(dto: ExercisePageDto): void;
}




