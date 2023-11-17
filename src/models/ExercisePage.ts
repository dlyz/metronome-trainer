import { BasicEvent } from "../Event";
import { Exercise, ExerciseDto } from "./Exercise";


export interface ExercisePage {

	readonly pageId: string;

	// todo: make exercise optional, extract some methods to the page (full update, event)
	readonly exercise?: Exercise;

	readonly onChanged: BasicEvent;

	refreshPage(): Promise<void>;

	createExercise(): Promise<void>;

	exportDto(): ExercisePageDto;
}



export interface ExercisePageDto {
	type: "exercisePage";
	pageId: string;
	exercise?: ExerciseDto;
}
