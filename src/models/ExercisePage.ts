import { BasicEvent } from "../Event";
import { Exercise, ExerciseDto } from "./Exercise";


export interface ExercisePage {

	readonly pageId: string;

	readonly hasAccess?: boolean;

	readonly exercise?: Exercise;

	readonly onChanged: BasicEvent;

	refreshPage(): Promise<void>;

	createExercise(): Promise<void>;

	exportDto(): ExercisePageDto;
}



export interface ExercisePageDto {
	type: "exercisePage";
	pageId: string;
	hasAccess?: boolean;
	exercise?: ExerciseDto;
}
