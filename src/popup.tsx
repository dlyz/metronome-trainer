import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderApp } from "./components/App";
import { ExercisePage } from "./models/ExercisePage";
import { Button, Spinner, Text, makeStyles } from "@fluentui/react-components";
import { startClient } from "./chromeTransport/client";
import { ObservableValueControl } from "./Event";
import { Exercise } from "./models/Exercise";


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

interface PopupState {
	hasAccess?: boolean,
	page?: ExercisePage,
	exercise?: Exercise,
}

const Popup = ({observablePage}: {observablePage: ObservableValueControl<ExercisePage | undefined> }) => {


	const [state, setState] = useState<PopupState>({});
	const [isLoading, setIsLoading] = useState(false);

	function updateState() {
		const page = observablePage.value;
		setState({
			hasAccess: page?.hasAccess,
			page,
			exercise: page?.exercise
		});
	}

	useLayoutEffect(() => {
		updateState();
		observablePage.add(updateState);
		return () => observablePage.remove(updateState);
	}, [observablePage]);

	const { page, exercise, hasAccess } = state;

	useLayoutEffect(() => {
		if (!page) return;

		page.onChanged.add(updateState);
		return () => page.onChanged.remove(updateState);
	}, [page])


	const onOpenOptionsClick = useCallback(() => {
		chrome.runtime.openOptionsPage();
	}, [])

	const onCreateExerciseClick = useCallback(async () => {
		if (!page) return;

		setIsLoading(true);
		try {
			try {
				await page.createExercise();
			} catch(ex) {
				console.error("creation failed", ex);
				await page.refreshPage();
				return;
			}

		} finally {
			setIsLoading(false);
		}

	}, [page]);

	const styles = useStyles();

	return <div className={styles.root}>
		{createContent()}
	</div>

	function createContent() {
		if (isLoading || (page && hasAccess === undefined)) {
			return (<Spinner />);

		} else if (page) {
			if (exercise) {
				return (<Text>
					<p>
						Exercise found, check bottom right corner of the page.
					</p>
					<p>
						If there is nothing there, try to update the page.
					</p>
				</Text>);
			} else if (!hasAccess) {
				return (<Text>
					<p>
						The extension does not have access to current page {page.pageId}.
					</p>
					<p>
						Check Notion page connections and Notion integration token in <a href="javascript:void(0)" onClick={onOpenOptionsClick}>extension options page</a>.
					</p>
				</Text>);
			} else {
				return (<Button appearance="primary" onClick={onCreateExerciseClick}>Create exercise on current page</Button>);
			}

		} else {
			return (<Text>Current page is not a Notion page.</Text>);
		}
	}
};

const root = createRoot(document.getElementById("root")!);


async function initialize() {

	const currentTab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
	if (!currentTab || !currentTab.id) return;


	const observablePage = new ObservableValueControl<ExercisePage | undefined>(undefined);

	const client = await startClient({
		keepAlive: true,
		sourceTabId: currentTab.id,
		onNewExercisePage: (page) => {
			observablePage.setValue(page);
		}
	});

	observablePage.value?.refreshPage();

	renderApp(root, (
		<Popup observablePage={observablePage} />
	));
}

initialize();
