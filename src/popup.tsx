import React, { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderApp } from "./components/App";
import { ExercisePage, ExercisePageInfo } from "./models/ExercisePage";
import { Button, Spinner, Text, makeStyles, shorthands } from "@fluentui/react-components";
import { startClient } from "./chrome/client";
import { ObservableValueControl } from "./primitives/Event";
import { Exercise } from "./models/Exercise";
import { projectHomepageUrl } from "./Notion/notionUrl";
import { renderFormattedText } from "./components/renderFormattedText";


const useStyles = makeStyles({
	root: {
		minWidth: "250px",
		minHeight: "100px",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	initButtonsRoot: {
		display: "flex",
		flexDirection: "column",
		"& > button": {
			...shorthands.margin("16px"),
		}
	},
})

interface PopupState {
	accessInfo?: ExercisePageInfo,
	page?: ExercisePage,
	exercise?: Exercise,
}

const Popup = ({observablePage}: {observablePage: ObservableValueControl<ExercisePage | undefined> }) => {


	const [state, setState] = useState<PopupState>({});
	const [isLoading, setIsLoading] = useState(false);

	function updateState() {
		const page = observablePage.value;
		setState({
			accessInfo: page?.pageInfo,
			page,
			exercise: page?.exercise
		});
	}

	useLayoutEffect(() => {
		updateState();
		return observablePage.subscribe(updateState);
	}, [observablePage]);

	const { page, exercise, accessInfo } = state;

	useLayoutEffect(() => {
		if (!page) return;

		return page.onChanged.subscribe(updateState);
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
				await page.refresh();
				return;
			}

		} finally {
			setIsLoading(false);
		}

	}, [page]);

	const onNavigateToProjectHomePageClick = useCallback(() => {
		window.open(projectHomepageUrl, "mozillaTab");
	}, []);

	const styles = useStyles();

	return <div className={styles.root}>
		{createContent()}
	</div>

	function createContent() {

		function homepageLink(content: string) {
			return <a target="_blank" rel="noopener noreferrer" href={projectHomepageUrl}>{content}</a>;
		}

		const gotoHomepage = <p>
			To start using Metronome Trainer go to
			the {homepageLink("project homepage")} for a
			getting started guide.
		</p>

		if (isLoading || (page && accessInfo === undefined)) {
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
					<p>
						{ homepageLink("Metronome Trainer homepage") }
					</p>
				</Text>);
			} else if (!accessInfo?.hasAccess) {
				return (<Text>
					<p>
						The extension does not have access to the current page ({page.pageId}).
					</p>
					{ accessInfo?.error && renderFormattedText(accessInfo.error, {
						renderLink: (key, link) => {
							if (link.link === "metrotrain://extension-options") {
								return <a key={key} href="javascript:void(0)" onClick={onOpenOptionsClick}>
									{link.text}
								</a>
							}

							return undefined;
						}
					}) }
					{ gotoHomepage }
				</Text>);
			} else {

				return (<div className={styles.initButtonsRoot}>
					<Button appearance="primary" onClick={onNavigateToProjectHomePageClick}>
						Start with duplicating one of the example exercise pages to your workspace (recommended)
					</Button>
					{/* <Button appearance="outline" onClick={onCreateExerciseClick}>
						Create exercise on current page from scratch
					</Button> */}
				</div>);
			}

		} else {
			return (<Text>
				<p>Current page is not a Notion page.</p>
				{ gotoHomepage }
			</Text>);
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

	observablePage.value?.refresh();

	renderApp(root, (
		<Popup observablePage={observablePage} />
	));
}

initialize();
