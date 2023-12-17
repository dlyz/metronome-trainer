import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { ClickDescriptor, ClickEventHandler, Metronome as MetronomeCore, MetronomeOptions, MetronomeTask } from "../metronome";
import { Button, Card, GriffelStyle, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Tooltip, makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";
import { ArrowResetFilled, PauseFilled, PlayFilled, StopFilled } from "@fluentui/react-icons";
import { BasicEvent, EventControl } from "../Event";
import { useInitializedRef } from "./reactHelpers";


export interface MetronomeProps {
	task: MetronomeTask,
	resetToken?: any,
	onStateChanged?: (state: MetronomeState) => void,
	onClick?: (core: MetronomeCore, descriptor: ClickDescriptor) => void;
}

export enum MetronomeState {
	Stopped,
	Playing,
	Paused,
	Finished,
}

const useClasses = makeStyles({
	card: {
		height: "88px",
		width: "100%",
		paddingTop: 0,
		paddingBottom: 0,
	},
	cardBottom: {
		...shorthands.margin(0, "calc(var(--fui-Card--size) * -1)"),
		...shorthands.padding(0, "var(--fui-Card--size)"),
		backgroundColor: "#00000010",
		height: "100%",
	},

	hRoot: {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		columnGap: "12px",
		...shorthands.margin("4px", 0),
	},
	vRoot: {
		...shorthands.flex(1),
		alignSelf: "stretch",

		display: "flex",
		flexDirection: "column",
	},
	vRootBottom: {
		minWidth: 0,
		display: "flex",
	},

	clickViewContainer: {
		...shorthands.flex(1),
		display: "flex",
		alignSelf: "stretch",
	},

	elapsedViewContainer: {
		minWidth: 0,
		...shorthands.flex(1),
		display: "flex",
		...shorthands.margin("2px", "2px", "2px", 0),
	},


	playPauseButton: {
		maxWidth: "initial",
		...shorthands.margin("-4px"),
		'& > span': {
			height: "initial",
			width: "initial",
			'& svg': {
				fontSize: "34px",
			}
		}

	},
	resetButton: {
		marginBottom: "-1px",
		marginLeft: "4px",
		marginRight: "-9px",
	}

});

const resetClickDescriptor: ClickDescriptor = {
	partIndex: 0,
	partMeasureIndex: 0,
	measureBeatIndex: -1,
	beatNoteIndex: 0,
	accent: 0,
	partStartTime: 0,
};

export const Metronome = React.memo(function (props: MetronomeProps) {

	const { core, clickEvent } = useInitializedRef(() => ({
		core: new MetronomeCore(),
		clickEvent: new EventControl<[MetronomeCore, ClickDescriptor]>(),
	})).current;

	const [currentPartIndex, setCurrentPartIndex] = useState(0);

	useEffect(() => {
		clickEvent.add((core, d) => {
			setCurrentPartIndex(d.partIndex);
		})
		return () => core.stop();
	}, []);

	const { task, onStateChanged, resetToken, onClick } = props;

	useEffect(() => {
		if (onClick) {
			clickEvent.add(onClick);
			return () => clickEvent.remove(onClick);
		}
	}, [onClick]);

	const [state, setState] = useState(MetronomeState.Stopped);

	const onFinishedRef = useRef<() => void>();

	onFinishedRef.current = useCallback(() => {
		clickEvent.invoke(core, { ...resetClickDescriptor, partIndex: task.parts.length });
		setState(MetronomeState.Paused);
		onStateChanged?.(MetronomeState.Finished);
	}, [onStateChanged, task]);

	const onPlayPause = useCallback(() => {
		if (state === MetronomeState.Playing) {
			core.pause();
			setState(MetronomeState.Paused);
			onStateChanged?.(MetronomeState.Paused);
		} else if (state === MetronomeState.Paused) {
			if (core.resume()) {
				setState(MetronomeState.Playing);
				onStateChanged?.(MetronomeState.Playing);
			}
		} else {
			core.restart(
				task,
				(descriptor) => clickEvent.invoke(core, descriptor),
				() => onFinishedRef.current!()
			);
			setState(MetronomeState.Playing);
			onStateChanged?.(MetronomeState.Playing);
		}
	}, [state, task, onStateChanged]);

	const onResetClick = useCallback(() => {
		core.stop();
		clickEvent.invoke(core, resetClickDescriptor);
		setState(MetronomeState.Stopped);
		onStateChanged?.(MetronomeState.Stopped);
	}, [onStateChanged]);

	useLayoutEffect(() => {
		onResetClick();
	}, [resetToken, task]);

	const displayPartIndex = Math.min(currentPartIndex, task.parts.length - 1);
	const part = task.parts[displayPartIndex];
	const partView = task.parts.length !== 1;


	const classes = useClasses();

	const playPauseButton = (
		<Button
			className={classes.playPauseButton}
			icon={state === MetronomeState.Playing ? <PauseFilled /> : <PlayFilled />}
			onClick={onPlayPause}
			appearance="subtle"
			shape="circular"
		/>
	);

	const resetButton = (
		<Button
			className={classes.resetButton}
			icon={<ArrowResetFilled />}
			onClick={onResetClick}
			appearance="transparent"
			size="small"
		/>
	);


	return <Card className={classes.card}>
		{partView ? (
			<>
			<div className={classes.vRoot}>

				<div className={classes.hRoot}>
					<BpmDisplay options={part} />
					<div>
						{playPauseButton}
					</div>
					<div className={classes.clickViewContainer}>
						<ClickView options={part} clickEvent={clickEvent} />
					</div>
				</div>

				<div className={ mergeClasses(classes.vRootBottom, classes.cardBottom)}>
					<div className={classes.elapsedViewContainer}>
						<ElapsedView clickEvent={clickEvent} task={task} />
					</div>

					{resetButton}
				</div>

			</div>
			</>
		) : (
			<div className={classes.hRoot}>
				<TaskDescriptionTooltip task={task}>
					<div>
						<BpmDisplay options={part} />
					</div>
				</TaskDescriptionTooltip>

				<div>
					{playPauseButton}
				</div>

				<div className={classes.vRoot}>
					<div className={classes.clickViewContainer}>
						<ClickView options={part} clickEvent={clickEvent} />
					</div>
					<div className={classes.vRootBottom}>
						<div className={classes.elapsedViewContainer}>
							<ElapsedView clickEvent={clickEvent} task={task} />
						</div>

						{resetButton}
					</div>
				</div>
			</div>
		)}

	</Card>

});


const useBpmDisplayClasses = makeStyles({
	root: {
		minWidth: "88px",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
	}

});

function BpmDisplay({ options }: { options: MetronomeOptions }) {

	const classes = useBpmDisplayClasses();
	return <div className={classes.root}>
		<div>
			<Text size={600} weight="semibold">{options.bpm}</Text>
			<Text size={300}> bpm</Text>
		</div>
		<div>
			<Text size={400} align="center">{options.signature[0]}/{options.signature[1]}</Text>
		</div>
	</div>
}

export function formatTime(seconds: number) {
	const totalSec = Math.round(seconds);
	const min = Math.trunc(totalSec / 60);
	const sec = totalSec - min * 60;

	return min + ":" + (sec < 10 ? '0' : '') + sec;
}


const useElapsedViewClasses = makeStyles({
	root: {
		minWidth: 0,
		...shorthands.flex(1),
		display: "flex",
		alignItems: "center",
		justifyContent: "space-evenly",
		...shorthands.margin(0, "-4px"),
	},
	part: {
		minWidth: 0,
		...shorthands.flex(1),
		display: "flex",
		...shorthands.margin(0, "4px"),
		"& > span": {
			whiteSpace: "nowrap",
			...shorthands.overflow("hidden"),
			textOverflow: "ellipsis",
		}
	},
	item: {
		flexShrink: 0,
		...shorthands.margin(0, "8px"),
	},
	border: {
		flexShrink: 0,
		width: "2px",
		backgroundColor: "#00000018",
		alignSelf: "stretch",
		...shorthands.borderRadius("1px"),
		...shorthands.margin("1px"),
	},
});

type PositionState = {
	partStartTime: number,
	partElapsedSeconds: number,
	partIndex: number,
	partMeasureIndex: number
}

const ElapsedView = React.memo(function ({ clickEvent, task }: {
	clickEvent: BasicEvent<[MetronomeCore, ClickDescriptor]>,
	task: MetronomeTask,
}) {

	const classes = useElapsedViewClasses();
	const [position, setPosition] = useState<PositionState>({
		partStartTime: 0,
		partElapsedSeconds: 0,
		partIndex: 0,
		partMeasureIndex: 0
	});

	useLayoutEffect(() => {
		const handler = (core: MetronomeCore, d: ClickDescriptor) => {
			if (d.partIndex === core.task?.parts.length) {
				// want to keep all the info from the last part except for elapsedSeconds.
				setPosition(p => ({
					...p,
					partElapsedSeconds: core.totalElapsedSeconds - p.partStartTime,
				}));

			} else {
				setPosition({
					partStartTime: d.partStartTime,
					partIndex: d.partIndex,
					partMeasureIndex: d.partMeasureIndex,
					partElapsedSeconds: core.totalElapsedSeconds - d.partStartTime,
				});
			}
		};

		clickEvent.add(handler);
		return () => clickEvent.remove(handler);
	}, []);


	const part = task.parts[position.partIndex];
	const partText = useMemo(() => {

		let partText = `${position.partIndex + 1} of ${task.parts.length}`;
		if (part.name) {
			partText += ": " + part.name;
		} else {
			partText = "Part " + partText;
		}

		return partText;
	}, [part]);


	return <div className={classes.root}>
		{task.parts.length > 1 && (
		<>
			<TaskDescriptionTooltip task={task}>
				<div className={classes.part}>
					<Text size={400} weight="semibold">
						{partText}
					</Text>
				</div>
			</TaskDescriptionTooltip>
			<div className={classes.border} />
		</>
		)}


		<Text size={400} className={classes.item}>
			bar: {position.partMeasureIndex + 1}{part.duration.units === "measures" && ("/" + part.duration.value)}
		</Text>
		<div className={classes.border} />
		<Text size={400} className={classes.item}>
			{formatTime(position.partElapsedSeconds)}{part.duration.units === "seconds" && ("/" + formatTime(part.duration.value))}
		</Text>

		<div className={classes.border} />
	</div>
});


function makeActiveItemEffectStyle(index: number): GriffelStyle {
	return {
		animationDuration: "0.1s",
		animationDirection: "alternate",
		animationName: {
			"to": {
				backgroundColor: "#8f2b2b",
				opacity: 1 + index * 0.01,
			}
		},
	};
}
const useClickViewClasses = makeStyles({
	root: {
		...shorthands.flex(1),
		display: "flex",
		alignItems: "center",
		justifyContent: "space-evenly",
		//...shorthands.margin("10%", 0),
	},
	item: {
		//backgroundColor: "lightgray",
		...shorthands.borderRadius("50%"),
		height: "45%",
		aspectRatio: "1",
		position: "relative",
		top: "1px",
	},
	activeItem: {
		...shorthands.transition("all", "0.1s"),
		top: "-4px",
	},
	activeItemEffect1: makeActiveItemEffectStyle(0),
	activeItemEffect2: makeActiveItemEffectStyle(1),

});


const useAccentClasses = makeStyles({
	0: {
		backgroundColor: "#00000010",
	},
	1: {
		backgroundColor: "#00000050",
	},
	2: {
		backgroundColor: "#00000090",
	},
	3: {
		backgroundColor: "#000000c0",
	},
});



const ClickView = React.memo(function ({ clickEvent, options }: {
	clickEvent: BasicEvent<[MetronomeCore, ClickDescriptor]>,
	options: MetronomeOptions,
}) {

	const [state, setState] = useState({ beatIndex: -1, noteIndex: 0, accent: 0 });
	const classes = useClickViewClasses();
	const accentClasses = useAccentClasses();

	useLayoutEffect(() => {
		const handler = (core: MetronomeCore, d: ClickDescriptor) => {
			setState({ beatIndex: d.measureBeatIndex, noteIndex: d.beatNoteIndex, accent: d.accent });
		};
		clickEvent.add(handler);
		return () => clickEvent.remove(handler);
	}, []);

	const beatsCount = options.signature[0];

	const maxWidth = 85 / beatsCount;
	const children = [];
	for (let index = 0; index < beatsCount; index++) {
		let className = [classes.item];


		const accent = Math.min(3, options.beatAccents[index] ?? 1) as 0 | 1 | 2 | 3;
		className.push(accentClasses[accent]);

		if (index === state.beatIndex) {
			className.push(classes.activeItem);
			className.push(state.noteIndex % 2 ? classes.activeItemEffect1 : classes.activeItemEffect2);
		}

		children.push((
			<div key={index} className={mergeClasses(...className)} style={{ maxWidth: maxWidth + "%" }}>
			</div>
		));
	}

	return <div className={classes.root}>
		{children}
	</div>
});


const useTaskDescriptionTooltipClasses = makeStyles({
	tooltip: {
		maxWidth: "600px",
	}
});


const TaskDescriptionTooltip = React.memo(function ({task, children}: { task: MetronomeTask, children: React.ReactElement}) {

	const classes = useTaskDescriptionTooltipClasses();

	return <Tooltip content={{ children: (<TaskDescription task={task} />), className: classes.tooltip}}
		relationship="description"
		withArrow
		showDelay={750}
	>
		{children}
	</Tooltip>
});

const TaskDescription = React.memo(function ({task}: {task: MetronomeTask}) {

	const showNames = task.parts.some(p => !!p.name);
	return <Table size="extra-small" style={{ width: "auto" }}>
		<TableHeader>
			<TableRow>
				<TableHeaderCell>#</TableHeaderCell>
				{ showNames && (<TableHeaderCell>name</TableHeaderCell> )}
				<TableHeaderCell>t-sig</TableHeaderCell>
				<TableHeaderCell>bpm</TableHeaderCell>
				<TableHeaderCell>dur</TableHeaderCell>
				<TableHeaderCell>click</TableHeaderCell>
				<TableHeaderCell>accents</TableHeaderCell>
			</TableRow>
		</TableHeader>
		<TableBody>

			{task.parts.map((p, i) => (
				<TableRow>
					<TableCell>{i + 1}</TableCell>
					{ showNames && (<TableCell>{p.name ?? ""}</TableCell> )}
					<TableCell>{p.signature[0]}/{p.signature[1]}</TableCell>
					<TableCell>{p.bpm}</TableCell>
					<TableCell>{p.duration.units === "measures" ? `${p.duration.value} bars` : formatTime(p.duration.value)}</TableCell>
					<TableCell>1/{p.signature[1]*p.beatDivider}</TableCell>
					<TableCell>{Array(p.signature[0]).fill(0).map((_, i) => <AccentItem key={i} value={(p.beatAccents[i] ?? 1)} />)}</TableCell>
				</TableRow>
			))}
		</TableBody>
	</Table>
});

const useAccentItemClasses = makeStyles({
	wrapper: {
		height: "100%",
		display: "inline-block",
		...shorthands.padding("4px", 0),
	},
	item: {
		width: "8px",
		backgroundColor: tokens.colorNeutralForeground1,
		opacity: 0.6,
		display: "inline-block",
	}
});

function AccentItem({value} : {value: number}) {
	const classes = useAccentItemClasses();
	return <div className={classes.wrapper} >
		<span className={classes.item} style={{ height: getHeight(value) }} />
	</div>

	function getHeight(value: number) {
		switch(value) {
			case 0: return '0';
			case 1: return '25%';
			case 2: return '65%';
			default: return '100%';
		}
	}
}
