import _ from "lodash";
import { EventControl } from "../Event";
import { BpmTableSpec, ExerciseBpmTable, ExerciseBpmTableDto } from "../models/BpmTable";
import { Exercise, ExerciseDto, ExerciseTask } from "../models/Exercise";
import { ExercisePage, ExercisePageDto } from "../models/ExercisePage";
import { ClientEvent, InvokeAsyncMethodRequest, ExercisePageRequest, KeepAliveRequest, ExceptionResponse } from "./messages";


export async function startClient(client: {
	onExercisePageInitialized: (page: ExercisePage) => void,
	keepAlive: boolean,
}) {

	let page: ProxyExercisePage | undefined;

	chrome.runtime.onMessage.addListener(function (message: ClientEvent, sender) {
		switch(message.type) {
			case "exercisePageChanged": {
				if (page) {
					page.update(message.page);
				} else {
					page = new ProxyExercisePage(message.page);
					client.onExercisePageInitialized(page);
				}
			}
			case "dummy": return;
			default: {
				const exhaustiveCheck: never = message;
				throw new Error("unknown message " + (message as any)?.type);
			}
		}
	});

	const initPage = await sendRequest<ExercisePageRequest, ExercisePageDto>({ type: "getExercisePage" });
	if (!page && initPage) {
		page = new ProxyExercisePage(initPage);
		client.onExercisePageInitialized(page);
	}

	if (client.keepAlive) {
		setInterval(() => {
			chrome.runtime.sendMessage<KeepAliveRequest, boolean>({ type: "keepAlive" });
		}, 15000);
	}
}

async function sendRequest<TRequest, TResponse extends object | undefined = undefined>(request: TRequest): Promise<TResponse> {
	const response = await chrome.runtime.sendMessage<TRequest, TResponse | ExceptionResponse>(request);
	if (response && ("type" in response) && response.type === "error") {
		throw new Error("remote exception: " + response.message);
	} else {
		return response as TResponse;
	}
}

class ProxyExercisePage implements ExercisePage {

	constructor(public dto: ExercisePageDto) {
		this.update(dto);
	}

	exportDto(): ExercisePageDto { return this.dto;	}

	update(dto: ExercisePageDto) {
		this.dto = dto;
		this.exercise = syncProxy(ProxyExercise, this.exercise, dto.exercise);
		this.onChanged.invoke();
	}

	get pageId() { return this.dto.pageId; }

	exercise?: ProxyExercise;

	readonly onChanged = new EventControl();

	refreshPage(): Promise<void> {
		return sendRequest<InvokeAsyncMethodRequest<ExercisePage, "refreshPage">>({
			type: "invokeAsyncMethod",
			target: "page",
			method: "refreshPage",
			arguments: [],
		});
	}

	createExercise(): Promise<void> {
		return sendRequest<InvokeAsyncMethodRequest<ExercisePage, "createExercise">>({
			type: "invokeAsyncMethod",
			target: "page",
			method: "createExercise",
			arguments: [],
		});
	}
}

class ProxyExercise implements Exercise {


	constructor(public dto: ExerciseDto) {
		this.update(dto);
	}

	exportDto(): ExerciseDto { return this.dto; }

	update(dto: ExerciseDto) {
		const oldDto = this.dto;
		this.dto = dto;
		if (_.isEqual(oldDto.currentTask, dto.currentTask)) dto.currentTask = oldDto.currentTask;
		if (_.isEqual(oldDto.bpmTableSpec, dto.bpmTableSpec)) dto.bpmTableSpec = oldDto.bpmTableSpec;
		if (_.isEqual(oldDto.errors, dto.errors)) dto.errors = oldDto.errors;
		this.bpmTable = syncProxy(ProxyBpmTable, this.bpmTable, dto.bpmTable);
	}

	get currentTask() { return this.dto.currentTask; }
	get bpmTableSpec() { return this.dto.bpmTableSpec; }
	get errors() { return this.dto.errors; }

	bpmTable?: ProxyBpmTable;

	refreshTask(): Promise<void> {
		return sendRequest<InvokeAsyncMethodRequest<Exercise, "refreshTask">>({
			type: "invokeAsyncMethod",
			target: "exercise",
			method: "refreshTask",
			arguments: [],
		});
	}

	finishTask(task: ExerciseTask): Promise<void> {
		return sendRequest<InvokeAsyncMethodRequest<Exercise, "finishTask">>({
			type: "invokeAsyncMethod",
			target: "exercise",
			method: "finishTask",
			arguments: [task],
		});
	}
}

class ProxyBpmTable implements ExerciseBpmTable {

	constructor(public dto: ExerciseBpmTableDto) {
		this.update(dto);
	}

	exportDto(): ExerciseBpmTableDto { return this.dto; }

	update(dto: ExerciseBpmTableDto) {
		this.dto = dto;
	}

	refill(spec: BpmTableSpec): Promise<void> {
		return sendRequest<InvokeAsyncMethodRequest<ExerciseBpmTable, "refill">>({
			type: "invokeAsyncMethod",
			target: "bpmTable",
			method: "refill",
			arguments: [spec],
		});
	}
}


function syncProxy<TProxy extends { update(dto: TDto): void }, TDto>(
	proxyCtor: { new(dto: TDto) : TProxy },
	currentProxy?: TProxy,
	dto?: TDto
) {
	if (dto) {
		if (!currentProxy) {
			currentProxy = new proxyCtor(dto);
		} else {
			currentProxy.update(dto);
		}

		return currentProxy;
	} else {
		return undefined;
	}
}
