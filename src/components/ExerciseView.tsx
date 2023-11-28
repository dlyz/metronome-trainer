import React, { useCallback, useLayoutEffect, useReducer, useState } from "react";
import { Metronome, MetronomeState } from "./Metronome";
import { Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Spinner, Tooltip, makeStyles, shorthands } from "@fluentui/react-components";
import { Exercise } from "../models/Exercise";
import { ExerciseTask } from "../models/ExerciseTask";
import { ExercisePage } from "../models/ExercisePage";
import { ArrowCircleUpFilled, ArrowSyncFilled, DocumentSyncRegular, NextFilled, TableSimpleIncludeRegular } from "@fluentui/react-icons";

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
	},

});

export const ExerciseView = React.memo(function ({ page, exercise }: ExerciseViewProps) {

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
				<Tooltip content="To new task" relationship="description">
					<Button onClick={onNewTaskClick} icon={<ArrowCircleUpFilled />} appearance="primary" />
				</Tooltip>
			)}

			<div className={styles.buttonPanelSpace} />

			{!!isLoading && <><Spinner size="tiny" /><div/></> }

			{state.currentTaskState !== MetronomeState.Finished && hasNextExercise && (
				<Tooltip content="To next exercise" relationship="description">
					<Button onClick={onNextExerciseClick} disabled={!!isLoading} icon={<NextFilled />} appearance="subtle" />
				</Tooltip>
			)}

			<Tooltip content="Update current task" relationship="description">
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
					resetToken={state.currentTask}
					onStateChanged={onMetronomeStateChanged}
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
