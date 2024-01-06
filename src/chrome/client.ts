import _ from "lodash";
import { EventControl } from "../primitives/Event";
import { BpmTableSpec } from "../models/BpmTable";
import { Exercise, ExerciseDto } from "../models/Exercise";
import { ExerciseTask } from "../models/ExerciseTask";
import { ExercisePage, ExercisePageContentScriptApi, ExercisePageContentScriptApiFactory, ExercisePageContentScriptApiUpdater, ExercisePageDto } from "../models/ExercisePage";
import { TabEvent, InvokeAsyncMethodRequest, ExercisePageRequest, KeepAliveRequest, ExceptionResponse, NonTabServerRequest, ServerRequest, TabsRuntimeEvent } from "./messages";

export class TabClient {

	constructor(private readonly sourceTabId?: number) {

	}

	async sendRequest<TRequest extends ServerRequest, TResponse extends object | undefined = undefined>(request: TRequest): Promise<TResponse> {
		let message: ServerRequest | NonTabServerRequest = request;
		if (this.sourceTabId) {
			message = {
				type: "nonTabRequest",
				request,
				sourceTabId: this.sourceTabId
			} satisfies NonTabServerRequest;
		}


		const response = await chrome.runtime.sendMessage<any, TResponse | ExceptionResponse>(message);
		if (response && ("type" in response) && response.type === "error") {
			throw new Error("remote exception: " + response.message);
		} else {
			return response as TResponse;
		}
	}
}

export async function startClient(options: {
	onNewExercisePage: (page: ExercisePage) => void,
	contentScriptApiFactory?: ExercisePageContentScriptApiFactory,
	keepAlive: boolean,
	sourceTabId?: number,
}) {

	const client = new TabClient(options.sourceTabId);

	let page: ProxyExercisePage | undefined;

	chrome.runtime.onMessage.addListener(function (message: TabEvent | TabsRuntimeEvent, sender) {
		let event;
		if (message.type === "tabsRuntimeEvent") {
			if (options.sourceTabId && message.targetTabs.includes(options.sourceTabId)) {
				event = message.event;
			} else {
				return;
			}
		} else {
			event = message;
		}

		switch(event.type) {
			case "exercisePageChanged": {
				if (page && page.pageId === event.page.pageId && page.dto.sourceType === event.page.sourceType) {
					page.update(event.page);
				} else {
					page = new ProxyExercisePage(client, options.contentScriptApiFactory, event.page);
					options.onNewExercisePage(page);
				}
			}
			case "dummy": return;
			default: {
				const exhaustiveCheck: never = event;
				throw new Error("unknown message " + (event as any)?.type);
			}
		}
	});


	const initPage = await client.sendRequest<ExercisePageRequest, ExercisePageDto>({ type: "getExercisePage" });
	if (!page && initPage) {
		page = new ProxyExercisePage(client, options.contentScriptApiFactory, initPage);
		options.onNewExercisePage(page);
	}

	if (options.keepAlive) {
		setInterval(() => {
			chrome.runtime.sendMessage<KeepAliveRequest, boolean>({ type: "keepAlive" });
		}, 15000);
	}
}


class ProxyExercisePage implements ExercisePage {

	constructor(
		readonly client: TabClient,
		contentScriptApiFactory: ExercisePageContentScriptApiFactory | undefined,
		public dto: ExercisePageDto,
	) {
		this.contentScriptApi = contentScriptApiFactory?.(dto);
		this.update(dto);
	}

	contentScriptApi: ExercisePageContentScriptApiUpdater | undefined;

	exportDto(): ExercisePageDto { return this.dto;	}

	update(dto: ExercisePageDto) {
		if (!dto.pageInfo) {
			// skipping update when the page is still initializing
			return;
		}

		copyUnchanged(["pageInfo"], this.dto, dto);
		this.dto = dto;
		this.exercise = syncProxy(this.client, this.pageId, ProxyExercise, this.exercise, dto.exercise);
		this.contentScriptApi?.update(dto);
		this.onChanged.invoke();
	}

	get pageId() { return this.dto.pageId; }

	get pageInfo() { return this.dto.pageInfo; }

	exercise?: ProxyExercise;

	readonly onChanged = new EventControl();

	refresh(): Promise<void> {
		return this.client.sendRequest<InvokeAsyncMethodRequest<ExercisePage, "refresh">>({
			type: "invokeAsyncMethod",
			pageId: this.pageId,
			target: "page",
			method: "refresh",
			arguments: [],
		});
	}

	createExercise(): Promise<void> {
		return this.client.sendRequest<InvokeAsyncMethodRequest<ExercisePage, "createExercise">>({
			type: "invokeAsyncMethod",
			pageId: this.pageId,
			target: "page",
			method: "createExercise",
			arguments: [],
		});
	}
}

class ProxyExercise implements Exercise {

	constructor(
		readonly client: TabClient,
		readonly pageId: string,
		public dto: ExerciseDto
	) {
		this.update(dto);
	}

	exportDto(): ExerciseDto { return this.dto; }

	update(dto: ExerciseDto) {
		copyUnchanged(
			["currentTask", "bpmTableSpec", "errors", "bpmTable"],
			this.dto,
			dto,
		);
		this.dto = dto;
	}

	get currentTask() { return this.dto.currentTask; }
	get bpmTableSpec() { return this.dto.bpmTableSpec; }
	get errors() { return this.dto.errors; }

	get bpmTable() { return this.dto.bpmTable; }

	refresh(): Promise<void> {
		return this.client.sendRequest<InvokeAsyncMethodRequest<Exercise, "refresh">>({
			type: "invokeAsyncMethod",
			pageId: this.pageId,
			target: "exercise",
			method: "refresh",
			arguments: [],
		});
	}

	finishTask(task: ExerciseTask): Promise<void> {
		return this.client.sendRequest<InvokeAsyncMethodRequest<Exercise, "finishTask">>({
			type: "invokeAsyncMethod",
			pageId: this.pageId,
			target: "exercise",
			method: "finishTask",
			arguments: [task],
		});
	}

	refillBpmTable(spec: BpmTableSpec, options?: { removeExcessCompleted?: boolean; }): Promise<void> {
		return this.client.sendRequest<InvokeAsyncMethodRequest<Exercise, "refillBpmTable">>({
			type: "invokeAsyncMethod",
			pageId: this.pageId,
			target: "exercise",
			method: "refillBpmTable",
			arguments: [spec, options],
		});
	}
}

function copyUnchanged<T, TKey extends keyof T>(keys: TKey[], from: T, to: T) {
	for (const key of keys) {
		if (_.isEqual(from[key], to[key])) to[key] = from[key];
	}
}

function syncProxy<TProxy extends { update(dto: TDto): void }, TDto>(
	client: TabClient,
	pageId: string,
	proxyCtor: { new(client: TabClient, pageId: string, dto: TDto) : TProxy },
	currentProxy?: TProxy,
	dto?: TDto
) {
	if (dto) {
		if (!currentProxy) {
			currentProxy = new proxyCtor(client, pageId, dto);
		} else {
			currentProxy.update(dto);
		}

		return currentProxy;
	} else {
		return undefined;
	}
}
