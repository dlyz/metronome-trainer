import { ExercisePageContentScriptApiFactory } from "../models/ExercisePage";
import { fblock, flink, fspan } from "../models/FormattedText";
import { MetronomeTrainer } from "../models/MetronomeTrainer";
import { NotionApi } from "./NotionApi";
import { NotionFormattedErrorFactory, NotionMetronomeTrainer } from "./NotionMetronomeTrainer";
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
		metronomeTrainer: new NotionMetronomeTrainer(notionApi, createNotionPageAccessError, contentScriptApiFactory),
	}
}

const createNotionPageAccessError: NotionFormattedErrorFactory = (type, message) => {

	switch (type) {
		case "noToken": return [fblock
			`${fspan(message)} Set the token in the ${flink("extensions options page", "metrotrain://extension-options")}.`
		];
		case "unauthorized": return [fblock
			`${fspan(message)} Try to reset Notion integration token in the ${flink("extensions options page", "metrotrain://extension-options")}.`
		];
		default: return [fblock`${fspan(message)}`];
	}
}