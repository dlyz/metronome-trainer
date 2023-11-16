import { ExercisePage } from "./ExercisePage";


export interface DrumTrainer {

	getPageIdFromUrl(url: string | undefined): string | undefined;

	createPage(pageId: string): ExercisePage;
}


