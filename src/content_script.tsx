import React from "react";
import { startClient } from "./chromeTransport/client";
import { Root, createRoot } from "react-dom/client";
import { renderApp } from "./components/App";
import { ExercisePage } from "./models/ExercisePage";
import { ExercisePageView } from "./components/ExercisePageView";

async function start() {

	let reactRoot: Root | undefined;
	let container: HTMLElement | undefined;

	let page: ExercisePage | undefined;


	function updatePage() {
		if (!page) return;

		if (!page.exercise) {

			if (reactRoot) {
				console.log("drum trainer: unmounting popup");
				reactRoot.unmount();
				reactRoot = undefined;
			}

			if (container) {
				//container.setAttribute("style", `position: absolute; top: 0; left: 0`);
			}

		} else {

			if (!container) {
				container = document.createElement('div');
				container.id = "drum-trainer-container";
				container.style.zIndex = "1000";
				container.style.position = "absolute";
				container.style.bottom = "10px";
				container.style.right = "10px";
				document.body.appendChild(container);
			}

			if (!reactRoot) {
				console.log("drum trainer: rendering popup");
				reactRoot = createRoot(container);
				renderApp(reactRoot, <Popup page={page} />, { transparent: true, });
			}
		}
	}


	await startClient({
		onExercisePageInitialized: (p) => {
			page = p;
			page.onChanged.add(() => updatePage());
			updatePage();
		},
		keepAlive: true,
	});

	console.log("drum trainer initialized");

}

start();

function Popup({ page }: { page: ExercisePage }) {

	return <div>
		<ExercisePageView page={page} />
	</div>;
}