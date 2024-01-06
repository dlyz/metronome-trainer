import { ExercisePage, ExercisePageDto } from "../models/ExercisePage";
import { TabEvent, ExceptionResponse, ServerRequest, TabExercisePageChangedEvent, TabsRuntimeEvent, NonTabServerRequest } from "./messages";

export function startServer(server: {
	getExercisePage: (tabId: number) => ExercisePage | undefined
}) {

	chrome.runtime.onMessage.addListener(function (rawMessage: ServerRequest | NonTabServerRequest, sender, sendResponse) {

		let tabId;
		let message: ServerRequest;
		if (rawMessage.type === "nonTabRequest") {
			tabId = rawMessage.sourceTabId;
			message = rawMessage.request;
		} else {
			tabId = sender.tab?.id;
			message = rawMessage;
		}

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
				if (!tabId) {
					sendResponse({ type: "error", message: "can not perform invokeAsyncMethod for undefined tabId" } satisfies ExceptionResponse);
					return;
				}

				const page = server.getExercisePage(tabId);
				if (page && page.pageId === message.pageId) {
					const request = message;
					// console.log("invokeAsyncMethod", request);
					return runAsyncRequest(async () => {
						const target =
							request.target === "page" ? page :
							request.target === "exercise" ? page.exercise :
							undefined;

						if (!target) {
							sendResponse({ type: "error", message: `unknown or absent target ${request.target}` } satisfies ExceptionResponse);
							return;
						}

						const promise = ((target as any)[request.method](...request.arguments) as Promise<void>);
						await promise;
						sendResponse(undefined);

					}, sendResponse);
				} else {
					sendResponse({ type: "error", message: `page ${message.pageId} not found in tab ${tabId} (with page ${page?.pageId})` } satisfies ExceptionResponse);
					return;
				}
			}
			default: {
				const exhaustiveCheck: never = message;
				// non request message
				return;
			}
		}
	});
}

function runAsyncRequest(
	action: () => Promise<void>,
	sendResponse: (response?: any) => void
) {
	action().catch(e => {
		sendResponse({ type: "error", message: e?.message } satisfies ExceptionResponse);
		throw e;
	});
	return true;
}

export function sendExercisePageUpdate(exercisePage: ExercisePageDto, tabs: Iterable<number>) {
	const message: TabExercisePageChangedEvent = {
		type: "exercisePageChanged",
		page: exercisePage,
	}

	return sendEvent(message, tabs);
}

function sendEvent(event: TabEvent, tabs: Iterable<number>) {

	const targetTabs = [...tabs];
	for (const tabId of targetTabs) {
		chrome.tabs.sendMessage(tabId, event);
	}

	const runtimeMessage: TabsRuntimeEvent = {
		type: "tabsRuntimeEvent",
		targetTabs,
		event,
	};

	chrome.runtime.sendMessage(runtimeMessage);
}
