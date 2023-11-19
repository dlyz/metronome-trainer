import React, { useLayoutEffect, useState } from "react";
import { startClient } from "./chromeTransport/client";
import { Root, createRoot } from "react-dom/client";
import { renderApp } from "./components/App";
import { ExercisePage } from "./models/ExercisePage";
import { ExercisePageView } from "./components/ExercisePageView";
import { ObservableValue, ObservableValueControl } from "./Event";

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
					container.style.bottom = "10px";
					container.style.right = "10px";
					document.body.appendChild(container);
				}

				if (!reactRoot) {
					console.log("metronome trainer: rendering popup");
					reactRoot = createRoot(container);
					renderApp(reactRoot, <Popup observablePage={observablePage} />, { transparent: true, });
				}
			}
		}
	});


	await startClient({
		onNewExercisePage: (p) => {
			observablePage.setValue(p);
		},
		keepAlive: true,
	});

	console.log("metronome trainer initialized");

}

start();

function Popup({ observablePage }: { observablePage: ObservableValue<ExercisePage | undefined> }) {

	const [page, setPage] = useState<ExercisePage>();
	useLayoutEffect(() => {
		setPage(observablePage.value);
		const handler = () => {
			setPage(observablePage.value);
		};
		observablePage.add(handler);
		return () => observablePage.remove(handler);
	}, [observablePage]);

	return <div>
		{ page && (<ExercisePageView page={page} />) }
	</div>;
}