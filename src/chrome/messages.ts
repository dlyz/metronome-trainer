import type { Exercise } from "../models/Exercise";
import type { ExercisePage, ExercisePageDto } from "../models/ExercisePage";

export type ServerRequest = never
| KeepAliveRequest
| ExercisePageRequest
| AnyInvokeAsyncMethodRequest
;

export type TabEvent = never
| TabExercisePageChangedEvent
| { type: "dummy" }
;

export interface NonTabServerRequest {
	type: "nonTabRequest",
	sourceTabId: number,
	request: ServerRequest
}

export interface KeepAliveRequest {
	type: "keepAlive",
}

export interface ExercisePageRequest {
	type: "getExercisePage",
}

export interface TabExercisePageChangedEvent {
	type: "exercisePageChanged",
	page: ExercisePageDto,
}

export interface TabsRuntimeEvent {
	type: "tabsRuntimeEvent",
	targetTabs: number[],
	event: TabEvent,
}

export interface ExceptionResponse {
	type: "error",
	message?: string,
}

export type InvokeAsyncMethodRequest<
	TTarget extends (ExercisePage | Exercise) & ObjectWithAsyncMethod<TMethod>,
	TMethod extends AsyncMethodKeysOf<TTarget> = AsyncMethodKeysOf<TTarget>,
	TMethodSignature extends TTarget[TMethod] = TTarget[TMethod],
> =
{
	type: "invokeAsyncMethod",
	pageId: string,
	target:
		TTarget extends ExercisePage ? "page" :
		TTarget extends Exercise ? "exercise" :
		never,
	method: TMethod,
	arguments: Parameters<TMethodSignature>,
}




export type AnyInvokeAsyncMethodRequest = never
	| InvokeAsyncMethodRequest<ExercisePage>
	| InvokeAsyncMethodRequest<Exercise>
	;


type ObjectWithAsyncMethod<TMethod extends keyof any> = {
	[key in TMethod]: (...args: any) => Promise<void>
}

type AsyncMethodKeysOf<T> = {
	[K in keyof T]-?: T[K] extends (...args: any) => Promise<void> ? K : never;
}[keyof T]

