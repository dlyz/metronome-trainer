import { ExercisePage, ExercisePageDto } from "../models/ExercisePage";
import { ServerRequest, TabExercisePageChangedEvent } from "./messages";

export function startServer(server: {
	getExercisePage: (tabId: number) => ExercisePage | undefined
}) {

	chrome.runtime.onMessage.addListener(function (message: ServerRequest, sender, sendResponse) {
		const tabId = sender.tab?.id;
		console.log(`message ${message.type} received`);
		switch (message.type) {
			case "keepAlive": {
				sendResponse(true);
				return;
			}
			case "getExercisePage": {
				if (tabId) {
					const page = server.getExercisePage(tabId);
					if (page) {
						console.log(`exercise page ${page.pageId} found for tab ${tabId}`);
						sendResponse(page.exportDto());
						return;
					}
				}

				console.log(`exercise page not found for tab ${tabId}`);
				sendResponse(undefined);
				return;
			}
			case "invokeAsyncMethod": {
				if (tabId) {
					const page = server.getExercisePage(tabId);
					if (page) {
						return runAsyncRequest(async () => {
							const target =
							message.target === "page" ? page :
							message.target === "exercise" ? page.exercise :
							message.target === "bpmTable" ? page.exercise?.bpmTable :
							undefined;

							const promise = target && ((target as any)[message.method](...message.arguments) as Promise<void>);
							await promise;
							sendResponse(undefined);

						}, sendResponse);
					}
				}

				sendResponse(undefined);
				return;
			}
			default: {
				const exhaustiveCheck: never = message;
				throw new Error("unknown message " + (message as any)?.type);
			}
		}
	});
}

function runAsyncRequest(
	action: () => Promise<void>,
	sendResponse: (response?: any) => void
) {
	action().catch(e => {
		sendResponse();
		throw e;
	});
	return true;
}

export function sendExercisePageUpdate(exercisePage: ExercisePageDto, tabs: Iterable<number>) {
	const message: TabExercisePageChangedEvent = {
		type: "exercisePageChanged",
		page: exercisePage,
	}

	for (const tabId of tabs) {
		chrome.tabs.sendMessage(tabId, message);
	}
}