import { ExerciseDto } from "../models/Exercise";
import { ExercisePageDto } from "../models/ExercisePage";


export interface NotionExercisePageDto extends ExercisePageDto {
	sourceType: "notion";
	nextExercisePageId?: string[];
}

export interface NotionExerciseDto extends ExerciseDto {
	bpmDatabaseId?: string,
	settingsBlockId?: string,
}