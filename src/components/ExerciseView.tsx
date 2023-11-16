import React, { useCallback, useLayoutEffect, useReducer, useState } from "react";
import { Metronome, MetronomeState } from "./Metronome";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Spinner, Tooltip, makeStyles, shorthands } from "@fluentui/react-components";
import { Exercise, ExerciseTask } from "../models/Exercise";
import { ExercisePage } from "../models/ExercisePage";
import { ArrowSyncFilled, DocumentSyncRegular, NextFilled, TableSimpleIncludeRegular } from "@fluentui/react-icons";

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
	const { currentTask } = state;
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

	useLayoutEffect(() => {
		const handler = () => {
			dispatch({ type: "setNewTask", task: exercise.currentTask });
		}
		page.onChanged.add(handler);
		dispatch({ type: "setNewTask", task: exercise.currentTask });
		return () => page.onChanged.remove(handler);
	}, [page, exercise]);

	const styles = useStyles();

	return (
		<div className={styles.root}>
			<div className={styles.buttonPanel}>
				{state.newTask && (
					<Tooltip content="To new task" relationship="description">
						<Button icon={<NextFilled />} onClick={onNewTaskClick} appearance="primary" />
					</Tooltip>
				)}

				<div className={styles.buttonPanelSpace} />

				{!!isLoading && <><Spinner size="tiny" /><div/></> }

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
			{currentTask && (
				<Metronome
					options={currentTask.metronomeOptions}
					duration={currentTask.duration}
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
}

type Action = never
	| {
		type: "useNewTask",
	}
	| {
		type: "setNewTask",
		task?: ExerciseTask,
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
		case "setNewTask": {
			if (state.currentTask === action.task) {
				// action used for exercise update, so we cannot reuse old state
				return {
					...state,
					newTask: undefined,
				};
			}
			else if (state.currentTaskState === MetronomeState.Stopped) {
				return setCurrentTask(action.task);
			} else {
				return {
					...state,
					newTask: action.task,
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
