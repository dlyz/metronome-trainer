import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createExtensionNotionDrumTrainer } from "./Notion/ExtensionNotionApi";
import { renderApp } from "./components/App";
import { ExercisePage } from "./models/ExercisePage";
import { Button, Spinner, Text, makeStyles } from "@fluentui/react-components";


interface State {
	isLoading?: boolean,
	pageId?: string,
	page?: ExercisePage,
}

const useStyles = makeStyles({
	root: {
		minWidth: "200px",
		minHeight: "100px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	}
})

// todo: migrate to background information for consistency. add page refresh button

const Popup = ({}: { }) => {


	const [state, setState] = useState<State>({ isLoading: true });

	async function init() {

		const api = await createExtensionNotionDrumTrainer();
		const currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
		console.log("current url", currentTab?.url);

		const pageId = api.getPageIdFromUrl(currentTab?.url);
		if (!pageId) {
			console.log("page not found");
			setState({});
			return;
		}

		const page = api.createPage(pageId);
		try {
			await page.refreshPage();
		} catch (ex) {
			console.log("can not create page, probably there is no access to it", ex);
			setState({ pageId });
			return;
		}

		console.log("page created");
		setState({ page });
	}


	useEffect(() => {
		init();

	}, []);

	const onOpenOptionsClick = useCallback(() => {
		chrome.runtime.openOptionsPage();
	}, [])

	const onCreateExerciseClick = useCallback(async () => {
		const page = state.page;
		if (!page) return;

		setState({isLoading: true});
		try {
			await page.createExercise();

		} catch(ex) {
			console.error("creation failed", ex);
			await init();
			return;
		}

		setState({ page });

	}, [state.page]);

	const styles = useStyles();

	return <div className={styles.root}>
		{createContent()}
	</div>

	function createContent() {
		if (state.isLoading) {
			return (<Spinner />);
		} else if (state.page) {
			if (state.page.exercise) {
				return (<Text>
					<p>
						Exercise found, check bottom right corner of the page.
					</p>
					<p>
						If there is nothing there, try to update the page.
					</p>
				</Text>);
			} else {
				return (<Button appearance="primary" onClick={onCreateExerciseClick}>Create exercise on current page</Button>);
			}
		} else if (state.pageId) {
			return (<Text>
				<p>
					The extension does not have access to current page {state.pageId}.
				</p>
				<p>
					Check Notion page connections and Notion integration token in <a href="javascript:void(0)" onClick={onOpenOptionsClick}>extension options page</a>.
				</p>
			</Text>);
		} else {
			return (<Text>Current page is not a Notion page.</Text>);
		}
	}
};

const root = createRoot(document.getElementById("root")!);


async function initialize() {

	renderApp(root, (
		<Popup />
	));
}

// async function initialize() {

// 	const api = await createExtensionNotionDrumTrainer();
// 	const currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
// 	//const currentTab = await chrome.tabs..getCurrent();
// 	console.log("current url", currentTab?.url);

// 	const pageId = NotionApi.getPageIdFromUrl(currentTab?.url);

// 	let page;

// 	if (pageId) {
// 		page = api.createPage(pageId);
// 		page.refreshPage();
// 	}

// 	renderApp(root, (
// 		<Popup page={page} />
// 	));
// }

initialize();