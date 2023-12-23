import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useState } from "react";
import { Metronome, MetronomeState, formatTime } from "./Metronome";
import { Button, Card, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Spinner, Tooltip, makeStyles, shorthands, Text, tokens, mergeClasses, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Popover, PopoverTrigger, PopoverSurface } from "@fluentui/react-components";
import { Exercise } from "../models/Exercise";
import { ExerciseTask } from "../models/ExerciseTask";
import { ExercisePage } from "../models/ExercisePage";
import { ArrowCircleUpFilled, ArrowSyncFilled, ChevronCircleDownFilled, DocumentSyncRegular, NextFilled, SettingsFilled, TableSimpleIncludeFilled, TableSimpleIncludeRegular, Warning20Filled, Warning24Filled } from "@fluentui/react-icons";
import type { ClickDescriptor, Metronome as MetronomeCore, MetronomeTask } from "../metronome";
import { BasicEvent, EventControl } from "../Event";
import { useInitializedRef } from "./reactHelpers";

export interface ExerciseViewProps {
	page: ExercisePage,
	exercise: Exercise,
	onHideMetronomeTrainer: () => void,
};


const useStyles = makeStyles({
	root: {
	},
	buttonPanel: {
		display: "flex",
		alignItems: "center",
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
	errorsIcon: {
		color: tokens.colorPaletteYellowForeground1,
		...shorthands.padding("6px"),
		width: "32px",
		height: "32px",
	},
	errorsButton: {
		color: tokens.colorPaletteYellowForeground1,
	},
	errorsTooltip: {
		whiteSpace: "pre-wrap",
	}

});

export const ExerciseView = React.memo(function ({ page, exercise, onHideMetronomeTrainer }: ExerciseViewProps) {


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

	async function refillDatabase(removeExcessCompleted: boolean) {
		await doAsyncCommand(() => page.refreshPage());
		if (!page.exercise) return;
		const { bpmTable, bpmTableSpec } = page.exercise;
		if (bpmTable && bpmTableSpec) {
			await doAsyncCommand(() => bpmTable.refill(bpmTableSpec, { removeExcessCompleted }));
			await doAsyncCommand(() => exercise.refreshTask());
		}
	}

	const onRefillDatabaseSoft = useCallback(() => refillDatabase(false), [page]);
	const onRefillDatabaseHard = useCallback(() => refillDatabase(true), [page]);

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
			dispatch({
				type: "pageUpdated",
				task: exercise.currentTask,
				hasNextExercise: page.contentScriptApi?.hasNextExercise,
				exerciseErrors: exercise.errors,
			});
		}
		page.onChanged.add(handler);
		handler();
		return () => page.onChanged.remove(handler);
	}, [page, exercise]);

	const styles = useStyles();
	const [refillDatabaseDialogOpened, setRefillDatabaseDialogOpened] = useState(false);
	const toggleRefillDatabaseDialog = useCallback(() => setRefillDatabaseDialogOpened(v => !v), []);
	const openRefillDatabaseDialog = useCallback(() => setRefillDatabaseDialogOpened(true), []);
	const errorsContent = useMemo(() => state.exerciseErrors?.join('\n'), [state.exerciseErrors]);

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

			<div className={styles.buttonPanelSpace}>
				<TaskStatus clickEvent={clickEvent} task={currentTask} />
			</div>

			{!!isLoading && <><Spinner size="tiny" /><div /></>}

			{ state.exerciseErrors && (
				<Popover>
					<PopoverTrigger disableButtonEnhancement>
						<Tooltip relationship="description" content="Show exercise errors">
							<Button icon={<Warning20Filled />} appearance="subtle" className={styles.errorsButton} />
						</Tooltip>
					</PopoverTrigger>
					<PopoverSurface>
						<div className={styles.errorsTooltip}>
							{errorsContent}
						</div>
					</PopoverSurface>
				</Popover>
			)}


			{state.currentTaskState !== MetronomeState.Finished && hasNextExercise && (
				<Tooltip content="To next exercise" relationship="description">
					<Button onClick={onNextExerciseClick} disabled={!!isLoading} icon={<NextFilled />} appearance="subtle" />
				</Tooltip>
			)}

			<Tooltip content="Update actual task" relationship="description">
				<Button onClick={onUpdateTaskClick} disabled={!!isLoading} icon={<ArrowSyncFilled />} appearance="subtle" />
			</Tooltip>

			<Menu>
				<MenuTrigger disableButtonEnhancement>
					<Tooltip content="More" relationship="description">
						<Button icon={<SettingsFilled />} appearance="subtle" />
					</Tooltip>
				</MenuTrigger>

				<MenuPopover>
					<MenuList>
						<MenuItem disabled={!!isLoading} icon={<DocumentSyncRegular />} onClick={onUpdateExerciseClick}>Update exercise</MenuItem>

						{exercise.bpmTable && exercise.bpmTableSpec && (
							<MenuItem disabled={!!isLoading} icon={<TableSimpleIncludeRegular />} onClick={onRefillDatabaseSoft}>Refill BPM Table</MenuItem>
						)}

						{exercise.bpmTable && exercise.bpmTableSpec && (
							<MenuItem disabled={!!isLoading} icon={<TableSimpleIncludeFilled />} onClick={openRefillDatabaseDialog}>Refill BPM Table (include completed)</MenuItem>
						)}
					</MenuList>
				</MenuPopover>
			</Menu>

			<Tooltip content="Hide Metronome Trainer" relationship="description">
				<Button onClick={onHideMetronomeTrainer} icon={<ChevronCircleDownFilled />} appearance="subtle" />
			</Tooltip>


			<Dialog open={refillDatabaseDialogOpened} onOpenChange={toggleRefillDatabaseDialog}>
				<DialogSurface>
					<DialogBody>
						<DialogTitle>Refill BPM Table</DialogTitle>
						<DialogContent>
							This action will refill BPM table according to BPMs specification in exercise properties.
							It will delete rows that are not included in the specification even for completed tasks.
						</DialogContent>
						<DialogActions>
							<DialogTrigger disableButtonEnhancement>
								<Button appearance="secondary">Close</Button>
							</DialogTrigger>
							<DialogTrigger disableButtonEnhancement>
								<Button appearance="primary" onClick={onRefillDatabaseHard}>I understand, refill</Button>
							</DialogTrigger>
						</DialogActions>
					</DialogBody>
				</DialogSurface>
			</Dialog>
		</div>
	);

	return (
		<div className={styles.root}>
			{currentTask ? buttons : (
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
	exerciseErrors?: string[],
}

type Action = never
	| {
		type: "useNewTask",
	}
	| {
		type: "pageUpdated",
		task?: ExerciseTask,
		hasNextExercise: boolean | undefined,
		exerciseErrors?: string[],
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
					exerciseErrors: action.exerciseErrors,
				};
			}
			else if (state.currentTaskState === MetronomeState.Stopped) {
				return {
					...setCurrentTask(action.task),
					hasNextExercise: action.hasNextExercise,
					exerciseErrors: action.exerciseErrors,
				};
			} else {
				return {
					...state,
					newTask: action.task,
					hasNextExercise: action.hasNextExercise,
					exerciseErrors: action.exerciseErrors,
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


	if (!task) return <Text size={400}>No incomplete tasks found</Text>;

	const bpmChanges = task.metronomeTask.parts.some(p => p.bpm !== task.baseBpm);
	const multipart = task.metronomeTask.parts.length > 1;

	if (!bpmChanges && !multipart) {
		return null;
	} else {
		return <div className={classes.root}>
			{bpmChanges && (<>
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
