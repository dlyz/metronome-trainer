import { MetronomeTrainer } from "../models/MetronomeTrainer";
import { NotionApi } from "./NotionApi";
import { NotionMetronomeTrainer } from "./NotionMetronomeTrainer";


export async function createChromeNotionMetronomeTrainer(): Promise<MetronomeTrainer> {

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

	return new NotionMetronomeTrainer(notionApi);
}
