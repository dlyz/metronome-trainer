import React, { useCallback, useEffect, useLayoutEffect, useReducer, useState } from "react";
import { Metronome, MetronomeState, formatTime } from "./Metronome";
import { Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Spinner, Tooltip, makeStyles, shorthands, Text, tokens, mergeClasses } from "@fluentui/react-components";
import { Exercise } from "../models/Exercise";
import { ExerciseTask } from "../models/ExerciseTask";
import { ExercisePage } from "../models/ExercisePage";
import { ArrowCircleUpFilled, ArrowSyncFilled, DocumentSyncRegular, NextFilled, TableSimpleIncludeRegular } from "@fluentui/react-icons";
import type { ClickDescriptor, Metronome as MetronomeCore } from "../metronome";
import { BasicEvent, EventControl } from "../Event";
import { useInitializedRef } from "./reactHelpers";

export interface ExerciseViewProps {
	page: ExercisePage,
	exercise: Exercise,
};


const useStyles = makeStyles({
	root: {
	},
	buttonPanel: {
		display: "flex",
		columnGap: "4px",
		...shorthands.margin("4px"),
	},
	buttonPanelSpace: {
		...shorthands.flex(1),
		display: "flex",
		// "& > *": {
		// 	...shorthands.margin(0, "10px"),
		// }
	},

});

export const ExerciseView = React.memo(function ({ page, exercise }: ExerciseViewProps) {


	const { clickEventInvoker, clickEvent } = useInitializedRef(() => {
		const clickEvent = new EventControl<[MetronomeCore, ClickDescriptor]>();
		return {
			clickEventInvoker: (core: MetronomeCore, d: ClickDescriptor) => clickEvent.invoke(core, d),
			clickEvent,
		};
	}).current;

	const [state, dispatch] = useReducer(stateReducer, { currentTaskState: MetronomeState.Stopped });
	const { currentTask, hasNextExercise } = state;
	const [isLoading, setIsLoading] = useState(0);

	const onRefillDatabase = useCallback(async () => {
		await doAsyncCommand(() => page.refreshPage());
		if (!page.exercise) return;
		const { bpmTable, bpmTableSpec } = page.exercise;
		if (bpmTable && bpmTableSpec) {
			await doAsyncCommand(() => bpmTable.refill(bpmTableSpec));
			await doAsyncCommand(() => exercise.refreshTask());
		}
	}, [page]);

	const onUpdateExerciseClick = useCallback(() => {
		doAsyncCommand(() => page.refreshPage());
	}, [page]);

	const onUpdateTaskClick = useCallback(() => {
		doAsyncCommand(() => exercise.refreshTask());
	}, [exercise]);

	const onMetronomeStateChanged = useCallback((state: MetronomeState) => {
		dispatch({ type: "setCurrentTaskState", state });
		if (state === MetronomeState.Finished && currentTask) {
			doAsyncCommand(() => exercise.finishTask(currentTask));
		}
	}, [exercise, currentTask]);

	const onNewTaskClick = useCallback(() => {
		dispatch({ type: "useNewTask" });
	}, []);

	const onNextExerciseClick = useCallback(() => {
		page.contentScriptApi?.toNextExercise();
	}, [page]);

	useLayoutEffect(() => {
		const handler = () => {
			dispatch({ type: "pageUpdated", task: exercise.currentTask, hasNextExercise: page.contentScriptApi?.hasNextExercise });
		}
		page.onChanged.add(handler);
		dispatch({ type: "pageUpdated", task: exercise.currentTask, hasNextExercise: page.contentScriptApi?.hasNextExercise });
		return () => page.onChanged.remove(handler);
	}, [page, exercise]);

	const styles = useStyles();

	const buttons = (
		<div className={styles.buttonPanel}>

			{state.currentTaskState === MetronomeState.Finished && hasNextExercise && (
				<Tooltip content="To next exercise" relationship="description">
					<Button onClick={onNextExerciseClick} icon={<NextFilled />} appearance="primary" />
				</Tooltip>
			)}

			{state.newTask && (
				<Tooltip content="To actual task" relationship="description">
					<Button onClick={onNewTaskClick} icon={<ArrowCircleUpFilled />} appearance="primary" />
				</Tooltip>
			)}

			<div className={styles.buttonPanelSpace + " qqq"}>
				<TaskStatus clickEvent={clickEvent} task={currentTask} />
			</div>

			{!!isLoading && <><Spinner size="tiny" /><div/></> }

			{state.currentTaskState !== MetronomeState.Finished && hasNextExercise && (
				<Tooltip content="To next exercise" relationship="description">
					<Button onClick={onNextExerciseClick} disabled={!!isLoading} icon={<NextFilled />} appearance="subtle" />
				</Tooltip>
			)}

			<Tooltip content="Update actual task" relationship="description">
				<Button onClick={onUpdateTaskClick} disabled={!!isLoading} icon={<ArrowSyncFilled />} appearance="subtle" />
			</Tooltip>

			<Tooltip content="Update exercise" relationship="description">
				<Button onClick={onUpdateExerciseClick} disabled={!!isLoading} icon={<DocumentSyncRegular />} appearance="subtle" />
			</Tooltip>
			{exercise.bpmTable && exercise.bpmTableSpec && (
				<Dialog>
					<DialogTrigger disableButtonEnhancement>
						<Tooltip content="Refill BPM Table" relationship="description">
							<Button disabled={!!isLoading} icon={<TableSimpleIncludeRegular />} appearance="subtle" />
						</Tooltip>
					</DialogTrigger>
					<DialogSurface>
						<DialogBody>
							<DialogTitle>Refill BPM Table</DialogTitle>
							<DialogContent>
								This action will refill BPM table according to BPMs specification in exercise properties.
								It will delete rows that are not included in the specification.
							</DialogContent>
							<DialogActions>
								<DialogTrigger disableButtonEnhancement>
									<Button appearance="secondary">Close</Button>
								</DialogTrigger>
								<DialogTrigger disableButtonEnhancement>
									<Button appearance="primary" onClick={onRefillDatabase}>I understand, refill</Button>
								</DialogTrigger>
							</DialogActions>
						</DialogBody>
					</DialogSurface>
				</Dialog>

			)}
		</div>
	);

	return (
		<div className={styles.root}>
			{ currentTask ? buttons : (
				<Card>
					{buttons}
				</Card>
			)}
			{currentTask && (
				<Metronome
					task={currentTask.metronomeTask}
					resetToken={currentTask}
					onStateChanged={onMetronomeStateChanged}
					onClick={clickEventInvoker}
				/>
			)}
		</div>
	);


	async function doAsyncCommand<T>(command: () => Promise<T>) {
		setIsLoading(v => v + 1);
		try {
			await command();
		} finally {
			setIsLoading(v => v - 1);
		}
	}


});



interface State {
	currentTask?: ExerciseTask,
	newTask?: ExerciseTask,
	currentTaskState: MetronomeState,
	hasNextExercise?: boolean,
}

type Action = never
	| {
		type: "useNewTask",
	}
	| {
		type: "pageUpdated",
		task?: ExerciseTask,
		hasNextExercise: boolean | undefined,
	}
	| {
		type: "setCurrentTaskState",
		state: MetronomeState,
	}
	;

function stateReducer(state: State, action: Action): State {
	switch (action.type) {
		case "useNewTask": {
			if (state.newTask) {
				return setCurrentTask(state.newTask);
			} else {
				return state;
			}
		}
		case "setCurrentTaskState": {

			//console.log("task state: " + MetronomeState[action.state]);
			return {
				...state,
				currentTaskState: action.state,
			};
		}
		case "pageUpdated": {
			if (state.currentTask === action.task) {
				// action used for exercise update, so we cannot reuse old state
				return {
					...state,
					newTask: undefined,
					hasNextExercise: action.hasNextExercise,
				};
			}
			else if (state.currentTaskState === MetronomeState.Stopped) {
				return  {
					...setCurrentTask(action.task),
					hasNextExercise: action.hasNextExercise,
				};
			} else {
				return {
					...state,
					newTask: action.task,
					hasNextExercise: action.hasNextExercise,
				};
			}
		}

		default: {
			const exhaustiveCheck: never = action;
			throw new Error("unsupported action " + (action as any)?.type);
		}
	}

	function setCurrentTask(task: ExerciseTask | undefined) {
		return {
			...state,
			currentTask: task,
			currentTaskState: MetronomeState.Stopped,
			newTask: undefined,
		};
	}
}


const useTaskStatusStyles = makeStyles({
	root: {
		...shorthands.flex(1),
		alignSelf: "center",
		display: "flex",
		alignItems: "center",
		justifyContent: "right",
		columnGap: "8px",
		color: tokens.colorNeutralForeground2,
	},

	rootRight: {
		justifyContent: "right",
	},

	taskHeader: {
		//...shorthands.flex(1),
	},

	border: {
		flexShrink: 0,
		width: "2px",
		backgroundColor: "#00000028",
		alignSelf: "stretch",
		...shorthands.borderRadius("1px"),
		...shorthands.margin("1px"),
	},

});


function TaskStatus({ task, clickEvent }: { task?: ExerciseTask, clickEvent: BasicEvent<[MetronomeCore, ClickDescriptor]> }) {

	const [taskTime, setTaskTime] = useState(0);
	useEffect(() => {
		const handler = (m: MetronomeCore) => {
			// rounding here is an optimization: don't have to rerender too often
			setTaskTime(Math.round(m.totalElapsedSeconds));
		};
		clickEvent.add(handler);
		return () => clickEvent.remove(handler);
	}, [clickEvent]);

	useLayoutEffect(() => {
		setTaskTime(0);
	}, [task]);

	const classes = useTaskStatusStyles();


	if (!task) return null;

	const bpmChanges = task.metronomeTask.parts.some(p => p.bpm !== task.baseBpm);
	const multipart = task.metronomeTask.parts.length > 1;

	if (!bpmChanges && !multipart) {
		return null;
	} else {
		return <div className={classes.root}>
			{ bpmChanges && (<>
				<div className={classes.taskHeader}>
					<Text size={400} >Task: {task.baseBpm} bpm</Text>
				</div>
				<div className={classes.border} />
			</>)}
			<div>
				<Text size={400}>{formatTime(taskTime)}</Text>
			</div>
			<div className={classes.border} />
		</div>
	}
}
