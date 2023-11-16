import { ExerciseBpmTable } from "../models/BpmTable";
import type { ExerciseDto, Exercise } from "../models/Exercise";
import { ExercisePage, ExercisePageDto } from "../models/ExercisePage";

export type ServerRequest = never
| KeepAliveRequest
| ExercisePageRequest
| AnyInvokeAsyncMethodRequest
;

export type ClientEvent = never
| TabExercisePageChangedEvent
| { type: "dummy" }
;


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

export type InvokeAsyncMethodRequest<
	TTarget extends (ExercisePage | Exercise | ExerciseBpmTable) & ObjectWithAsyncMethod<TMethod>,
	TMethod extends AsyncMethodKeysOf<TTarget> = AsyncMethodKeysOf<TTarget>,
	TMethodSignature extends TTarget[TMethod] = TTarget[TMethod],
> =
{
	type: "invokeAsyncMethod",
	target:
		TTarget extends ExercisePage ? "page" :
		TTarget extends Exercise ? "exercise" :
		TTarget extends ExerciseBpmTable ? "bpmTable" :
		never,
	method: TMethod,
	arguments: Parameters<TMethodSignature>,
}

type q = InvokeAsyncMethodRequest<ExerciseBpmTable>;


export type AnyInvokeAsyncMethodRequest = never
	| InvokeAsyncMethodRequest<ExercisePage>
	| InvokeAsyncMethodRequest<Exercise>
	| InvokeAsyncMethodRequest<ExerciseBpmTable>
	;


type ObjectWithAsyncMethod<TMethod extends keyof any> = {
	[key in TMethod]: (...args: any) => Promise<void>
}

type AsyncMethodKeysOf<T> = {
	[K in keyof T]-?: T[K] extends (...args: any) => Promise<void> ? K : never;
}[keyof T]

