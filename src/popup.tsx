import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Metronome } from "./components/Metronome";
import { NotionApi } from "./Notion/NotionApi";
import { createExtensionNotionDrumTrainer } from "./Notion/ExtensionNotionApi";
import { Exercise } from "./models/Exercise";
import { renderApp } from "./components/App";
import { ExerciseView } from "./components/ExerciseView";
import { ExercisePage } from "./models/ExercisePage";
import { ExercisePageView } from "./components/ExercisePageView";

const Popup = ({page}: { page?: ExercisePage }) => {
	// const [count, setCount] = useState(0);
	// const [currentURL, setCurrentURL] = useState<string>();

	// useEffect(() => {
	// 	chrome.action.setBadgeText({ text: count.toString() });
	// }, [count]);

	// useEffect(() => {
	// 	chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
	// 		setCurrentURL(tabs[0].url);
	// 	});
	// }, []);

	return page && (<ExercisePageView page={page} />);
};

const root = createRoot(document.getElementById("root")!);

async function initialize() {

	const api = await createExtensionNotionDrumTrainer();
	const currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
	//const currentTab = await chrome.tabs..getCurrent();
	console.log("current url", currentTab?.url);

	const pageId = NotionApi.getPageIdFromUrl(currentTab?.url);

	let page;

	if (pageId) {
		page = api.createPage(pageId);
		page.refreshPage();
	}

	renderApp(root, (
		<Popup page={page} />
	));
}

initialize();