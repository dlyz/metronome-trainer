import { ExercisePageContentScriptApiFactory } from "../models/ExercisePage";
import { MetronomeTrainer } from "../models/MetronomeTrainer";
import { NotionApi } from "./NotionApi";
import { NotionMetronomeTrainer } from "./NotionMetronomeTrainer";
import { notionTabUrlFilter } from "./notionUrl";


export interface ChromeMetronomeTrainer {
	metronomeTrainer: MetronomeTrainer,
	readonly tabUrlFilter: string;
}

export async function createChromeNotionMetronomeTrainer(
	contentScriptApiFactory?: ExercisePageContentScriptApiFactory
): Promise<ChromeMetronomeTrainer> {

	let notionApi: NotionApi | undefined;

	let tokenFromEvent: { token?: string } | undefined;

	chrome.storage.sync.onChanged.addListener(changes => {

		const tokenChange = changes["notionToken"];
		if (tokenChange) {
			if (notionApi) {
				notionApi.updateClient({ token: tokenChange.newValue });
			} else {
				tokenFromEvent = {
					token: tokenChange.newValue,
				};
			}
		}

	});

	const options = await chrome.storage.sync.get("notionToken");
	notionApi = new NotionApi({ token: tokenFromEvent?.token ?? options["notionToken"] });

	return {
		tabUrlFilter: notionTabUrlFilter,
		metronomeTrainer: new NotionMetronomeTrainer(notionApi, contentScriptApiFactory),
	}
}
