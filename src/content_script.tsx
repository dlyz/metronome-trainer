import React, { useEffect, useLayoutEffect, useState } from "react";
import { startClient } from "./chrome/client";
import { Root, createRoot } from "react-dom/client";
import { renderApp } from "./components/App";
import { ExercisePage } from "./models/ExercisePage";
import { ObservableValue, ObservableValueControl } from "./primitives/Event";
import { ExercisePageView } from "./components/ExercisePageView";
import { notionContentScriptApiFactory } from "./Notion/NotionContentScriptApi";
import { createChromeComponentSettingsStorage } from "./chrome/ChromeComponentSettingsStorage";
import { ComponentSettingsStorage, componentSettingsStorageContext } from "./components/storage";
import { CachedPromise, cachePromiseResult } from "./primitives/Promise";
import { projectHomepageUrl } from "./Notion/notionUrl";

async function start() {

	let reactRoot: Root | undefined;
	let container: HTMLElement | undefined;

	let pageSubscription: () => void | undefined;
	const observablePage = new ObservableValueControl<ExercisePage | undefined>(undefined);

	observablePage.add(() => {
		pageSubscription?.();

		const page = observablePage.value;

		if (page) {
			pageSubscription = page.onChanged.subscribe(updatePopup);
		}

		updatePopup();

		function updatePopup() {

			if (!page || !page.exercise) {

				if (reactRoot) {
					console.log("metronome trainer: unmounting popup");
					reactRoot.unmount();
					reactRoot = undefined;
				}

				if (container) {
					//container.setAttribute("style", `position: absolute; top: 0; left: 0`);
				}

			} else {

				if (!container) {
					container = document.createElement('div');
					container.id = "metronome-trainer-container";
					container.style.zIndex = "1000";
					container.style.position = "absolute";
					container.style.bottom = "0";
					container.style.width = "100%";
					container.style.pointerEvents = "none";
					document.body.appendChild(container);
				}

				if (!reactRoot) {
					console.log("metronome trainer: rendering popup");
					reactRoot = createRoot(container);
					renderApp(
						reactRoot,
						<Popup observablePage={observablePage} settingsPromise={settingsPromise} />,
						{ transparent: true, darkTheme: page.contentScriptApi?.createIsDarkThemeWatcher() }
					);
				}
			}
		}
	});

	const settingsPromise = cachePromiseResult(createChromeComponentSettingsStorage());

	const clientPromise = startClient({
		onNewExercisePage: (p) => {
			observablePage.setValue(p);
		},
		contentScriptApiFactory: notionContentScriptApiFactory,
		keepAlive: true,
	});

	await Promise.all([settingsPromise, clientPromise]);

	console.log("metronome trainer initialized");

}

start();

function Popup({ observablePage, settingsPromise }: {
	observablePage: ObservableValue<ExercisePage | undefined>
	settingsPromise: CachedPromise<ComponentSettingsStorage>,
}) {

	const [page, setPage] = useState<ExercisePage | undefined>(observablePage.value);
	useLayoutEffect(() => {
		setPage(observablePage.value);
		return observablePage.subscribe(() => {
			setPage(observablePage.value);
		});
	}, [observablePage]);

	const [settingsStorage, setSettingsStorage] = useState(settingsPromise.hasResult ? settingsPromise.result : undefined);
	useEffect(() => {
		(async function() {
			setSettingsStorage(await settingsPromise.promise);
		})();
	}, [settingsPromise]);

	const ComponentSettingsStorageContextProvider = componentSettingsStorageContext.Provider;

	return <div>
		{ settingsStorage && (
			<ComponentSettingsStorageContextProvider value={settingsStorage}>
				{ page && (
					<ExercisePageView page={page} homepageUrl={projectHomepageUrl} />
				)}
			</ComponentSettingsStorageContextProvider>
		)}
	</div>;
}