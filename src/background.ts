import { createExtensionNotionDrumTrainer } from "./Notion/ExtensionNotionApi";
import { sendExercisePageUpdate, startServer } from "./chromeTransport/background";
import { ExercisePage } from "./models/ExercisePage";

interface TrackedTab {
	tabId: number,
	page: BackgroundExercisePage,
}

const trackedPages = new Map<string, BackgroundExercisePage>();
const trackedTabs = new Map<number, TrackedTab>();

class BackgroundExercisePage {
	constructor(
		readonly page: ExercisePage
	) {
		this.page.onChanged.add(this.#handler);
		this.page.refreshPage();
	}

	#handler = () => {

		sendExercisePageUpdate(this.page.exportDto(), this.#tabs.keys());
	}

	readonly #tabs = new Set<number>();
	get pageId() { return this.page.pageId; }

	attachTab(tabId: number) {
		if (!this.#tabs.has(tabId)) {
			this.#tabs.add(tabId);
			sendExercisePageUpdate(this.page.exportDto(), this.#tabs.keys());
		}
	}

	detachTab(tabId: number): number {
		this.#tabs.delete(tabId);
		return this.#tabs.size;
	}

	close() {
		this.page.onChanged.remove(this.#handler);
	}
}




async function start() {

	startServer({
		getExercisePage(tabId) {
			const tab = trackedTabs.get(tabId);
			if (!tab) return undefined;
			return tab.page.page;
		},
	});


	console.log("creating api");
	const drumTrainer = await createExtensionNotionDrumTrainer();

	console.log("api created");

	chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {

		let pageToRefresh;
		if (changeInfo.url) {
			const [updated, pageId] = updateTab(tabId, changeInfo.url);
			if (pageId && !updated && changeInfo.status === "complete") {
				pageToRefresh = trackedPages.get(pageId);
			}

		} else if (changeInfo.status === "complete") {

			const pageId = drumTrainer.getPageIdFromUrl(tab.url);
			if (pageId) {
				pageToRefresh = trackedPages.get(pageId);
			}
		}

		if (pageToRefresh) {
			console.log(`refreshing page ${pageToRefresh.pageId}`);
			pageToRefresh.page.refreshPage();
		}

	});

	const existingTabs = await chrome.tabs.query({ url: "https://www.notion.so/*" });

	for (const tab of existingTabs) {
		if (tab.id && tab.url) {
			updateTab(tab.id, tab.url);
		}
	}

	console.log("tabs processed");



	function detachTabFromPage(tab: TrackedTab) {
		const page = tab.page;
		const tabs = page.detachTab(tab.tabId);

		console.log(`tab ${tab.tabId} detached from page ${page.pageId}`);

		if (tabs === 0) {
			page.close();
			trackedPages.delete(page.pageId);

			console.log(`page ${page.pageId} closed`);
		}
	}

	function attachTabToPage(tabId: number, pageId: string) {
		let page = trackedPages.get(pageId);
		if (!page) {
			page = new BackgroundExercisePage(drumTrainer.createPage(pageId));
			trackedPages.set(pageId, page);
			console.log(`page ${pageId} created`);
		}

		page.attachTab(tabId);
		console.log(`tab ${tabId} attached to page ${pageId}`);

		return page;
	}

	function updateTab(tabId: number, url: string): [boolean, string | undefined] {

		let trackedTab = trackedTabs.get(tabId);
		const pageId = drumTrainer.getPageIdFromUrl(url);

		if (trackedTab) {

			if (!pageId) {
				detachTabFromPage(trackedTab);
				trackedTabs.delete(tabId);
				return [true, undefined];
			} else {
				if (trackedTab.page.pageId !== pageId) {
					detachTabFromPage(trackedTab);
					trackedTab.page = attachTabToPage(tabId, pageId);
					return [true, pageId];
				}

				return [false, pageId];
			}

		} else if (pageId) {

			const page = attachTabToPage(tabId, pageId);
			trackedTab = {
				tabId,
				page,
			};

			trackedTabs.set(tabId, trackedTab);
			return [true, pageId];
		}

		return [false, undefined];
	}


}

start();
