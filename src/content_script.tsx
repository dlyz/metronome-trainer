import React, { useEffect, useLayoutEffect, useState } from "react";
import { startClient } from "./chromeTransport/client";
import { Root, createRoot } from "react-dom/client";
import { renderApp } from "./components/App";
import { ExercisePage } from "./models/ExercisePage";
import { ObservableValue, ObservableValueControl } from "./Event";
import { ExercisePageView } from "./components/ExercisePageView";
import { notionContentScriptApiFactory } from "./Notion/NotionContentScriptApi";
import { createChromeComponentSettingsStorage } from "./chromeTransport/ChromeComponentSettingsStorage";
import { ComponentSettingsStorage } from "./components/storage";
import { CachedPromise, cachePromiseResult } from "./Promise";
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
			page.onChanged.add(updatePopup);
			pageSubscription = () => page.onChanged.remove(updatePopup);
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
						{ transparent: true, }
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

	const [page, setPage] = useState<ExercisePage>();
	useLayoutEffect(() => {
		setPage(observablePage.value);
		const handler = () => {
			setPage(observablePage.value);
		};
		observablePage.add(handler);
		return () => observablePage.remove(handler);
	}, [observablePage]);

	const [settingsStorage, setSettingsStorage] = useState(settingsPromise.hasResult ? settingsPromise.result : undefined);
	useEffect(() => {
		(async function() {
			setSettingsStorage(await settingsPromise.promise);
		})();
	}, [settingsPromise]);

	return <div>
		{ page && settingsStorage && (
			<ExercisePageView page={page} settingsStorage={settingsStorage} homepageUrl={projectHomepageUrl} />
		)}
	</div>;
}