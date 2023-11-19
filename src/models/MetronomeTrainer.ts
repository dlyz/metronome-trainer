import { ExercisePage } from "./ExercisePage";


export interface MetronomeTrainer {

	getPageIdFromUrl(url: string | undefined): string | undefined;

	createPage(pageId: string): ExercisePage;
}


