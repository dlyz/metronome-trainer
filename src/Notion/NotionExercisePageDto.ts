import { ExerciseDto } from "../models/Exercise";
import { ExercisePageDto } from "../models/ExercisePage";


export interface NotionExercisePageDto extends ExercisePageDto {
	sourceType: "notion";
	nextExerciseInfo?: NotionNextExerciseInfo;
	exercise?: NotionExerciseDto;
}

export interface NotionNextExerciseInfo {
	/**
	 * list of pages from the next exercise page
	 * to the first common ancestor of current and next exercise pages
	 */
	nextExercisePageWithAncestorsIds?: string[],
}

export interface NotionExerciseDto extends ExerciseDto {
	bpmDatabaseId?: string,
	settingsBlockId?: string,
}