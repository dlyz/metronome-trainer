import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { ClickDescriptor, ClickEventHandler, Metronome as MetronomeCore, MetronomeOptions, MetronomeTask } from "../metronome";
import { Button, Card, GriffelStyle, Text, makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";
import { ArrowResetFilled, PauseFilled, PlayFilled, StopFilled } from "@fluentui/react-icons";
import { BasicEvent, EventControl } from "../Event";
import { useInitializedRef } from "./reactHelpers";


export interface MetronomeProps {
	task: MetronomeTask,
	resetToken?: any,
	onStateChanged?: (state: MetronomeState) => void,
}

export enum MetronomeState {
	Stopped,
	Playing,
	Paused,
	Finished = 3,
}

const useClasses = makeStyles({
	card: {
		height: "78px",
		width: "370px",
		paddingTop: "4px",
		paddingBottom: "4px",
	},
	root: {
		display: "flex",
		flexDirection: "row",
		alignItems: "center",
		columnGap: "16px",
	},
	bpmSection: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
	},
	playPauseButton: {
		maxWidth: "initial",
		...shorthands.margin("-6px"),
		'& > span': {
			height: "initial",
			width: "initial",
			'& svg': {
				fontSize: "34px",
			}
		}

	},
	clickSection: {
		...shorthands.flex(1),
		alignSelf: "stretch",

		display: "flex",
		flexDirection: "column",
	},
	clickViewContainer: {
		...shorthands.flex(1),
		display: "flex",
	},
	clickSectionBottom: {
		display: "flex",
	},
	elapsedViewContainer: {
		...shorthands.flex(1),
		display: "flex",
	},

});

const resetClickDescriptor: ClickDescriptor = {
	partIndex: 0,
	partMeasureIndex: 0,
	measureBeatIndex: -1,
	beatNoteIndex: 0,
	accent: 0,
};

export const Metronome = React.memo(function (props: MetronomeProps) {

	const { core, clickEvent } = useInitializedRef(() => ({
		core: new MetronomeCore(),
		clickEvent: new EventControl<[ClickDescriptor]>(),
	})).current;

	const [currentPartIndex, setCurrentPartIndex] = useState(0);

	useEffect(() => {
		clickEvent.add(d => {
			setCurrentPartIndex(d.partIndex);
		})
		return () => core.stop();
	}, []);

	const { task, onStateChanged, resetToken } = props;

	const [state, setState] = useState(MetronomeState.Stopped);

	const onFinishedRef = useRef<() => void>();

	onFinishedRef.current = useCallback(() => {
		clickEvent.invoke({ ...resetClickDescriptor, partIndex: task.parts.length });
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
				(descriptor) => clickEvent.invoke(descriptor),
				() => onFinishedRef.current!()
			);
			setState(MetronomeState.Playing);
			onStateChanged?.(MetronomeState.Playing);
		}
	}, [state, task, onStateChanged]);

	const onResetClick = useCallback(() => {
		core.stop();
		clickEvent.invoke(resetClickDescriptor);
		setState(MetronomeState.Stopped);
		onStateChanged?.(MetronomeState.Stopped);
	}, [onStateChanged]);

	useLayoutEffect(() => {
		onResetClick();
	}, [resetToken, task]);

	const displayPartIndex = Math.min(currentPartIndex, task.parts.length - 1);
	const part = task.parts[displayPartIndex];


	const classes = useClasses();

	return <Card className={classes.card}>
		<div className={classes.root}>

			<div className={classes.bpmSection}>
				<div>
					<Text size={600} weight="semibold">{part.bpm}</Text>
					<Text size={300}> bpm</Text>
				</div>
				<div>
					<Text size={400} align="center">{part.signature[0]}/{part.signature[1]}</Text>
				</div>
			</div>
			<div>
				<Button
					className={classes.playPauseButton}
					icon={ state === MetronomeState.Playing ? <PauseFilled /> : <PlayFilled /> }
					onClick={onPlayPause}
					appearance="subtle"
					shape="circular"


				/>
			</div>

			<div className={classes.clickSection}>
				<div className={classes.clickViewContainer}>
					<ClickView options={part} clickEvent={clickEvent} />
				</div>

				<div className={classes.clickSectionBottom}>
					<div className={classes.elapsedViewContainer}>
						<ElapsedView core={core} clickEvent={clickEvent} task={task} />
					</div>

					<Button
						icon={ <ArrowResetFilled /> }
						onClick={onResetClick}
						appearance="transparent"
						size="small"
					/>
				</div>
			</div>
		</div>
	</Card>

});

function formatTime(seconds: number) {
	const min = Math.trunc(seconds / 60);
	const sec = Math.round(seconds - min * 60);

	return min + ":" + (sec < 10 ? '0' : '') + sec;
}


const useElapsedViewClasses = makeStyles({
	root: {
		...shorthands.flex(1),
		display: "flex",
		alignItems: "end",
		justifyContent: "space-evenly",
	}

});

interface PositionState {
	elapsedMeasures: number,
	elapsedSeconds: number,
	elapsedParts: number,
}

const ElapsedView = React.memo(function({ core, clickEvent, task }: {
	core: MetronomeCore,
	clickEvent: BasicEvent<[ClickDescriptor]>,
	task: MetronomeTask,
}) {

	const classes = useElapsedViewClasses();
	const [position, setPosition] = useState<PositionState>({ elapsedParts: 0, elapsedMeasures: 0, elapsedSeconds: 0, });

	useLayoutEffect(() => {
		const handler = (d: ClickDescriptor) => {
			setPosition({
				elapsedMeasures: d.partMeasureIndex,
				elapsedSeconds: core.partElapsedSeconds,
				elapsedParts: d.partIndex,
			});
		};
		clickEvent.add(handler);
		return () => clickEvent.remove(handler);
	}, []);


	const displayPartIndex = Math.min(position.elapsedParts, task.parts.length - 1);

	const part = task.parts[displayPartIndex];

	return <div className={classes.root}>
		{ task.parts.length > 1 && (
			<Text size={400}>
				part: {displayPartIndex + 1}/{task.parts.length}
			</Text>
		)}

		{ position.elapsedParts !== displayPartIndex ? (
			<Text size={400}>
				task completed!
			</Text>

		) : (
			<>
				<Text size={400}>
					bars: {position.elapsedMeasures}{ part.duration.units === "measures" && ("/" + part.duration.value) }
				</Text>
				<Text size={400}>
					{formatTime(position.elapsedSeconds)}{ part.duration.units === "seconds" && ("/" + formatTime(part.duration.value)) }
				</Text>
			</>
		)}
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
		justifyContent: "space-around",
		//...shorthands.margin("10%", 0),
	},
	item: {
		//backgroundColor: "lightgray",
		...shorthands.borderRadius("50%"),
		height: "58%",
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



const ClickView = React.memo(function({ clickEvent, options }: {
	clickEvent: BasicEvent<[ClickDescriptor]>,
	options: MetronomeOptions,
}) {

	const [state, setState] = useState({ beatIndex: -1, noteIndex: 0, accent: 0 });
	const classes = useClickViewClasses();
	const accentClasses = useAccentClasses();

	useLayoutEffect(() => {
		const handler: ClickEventHandler = (d) => {
			setState({ beatIndex: d.measureBeatIndex, noteIndex: d.beatNoteIndex, accent: d.accent });
		};
		clickEvent.add(handler);
		return () => clickEvent.remove(handler);
	}, []);

	const beatsCount = options.signature[0];

	const maxWidth = 90/beatsCount;
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
			<div key={index} className={mergeClasses(...className)} style={{maxWidth: maxWidth + "%"}}>
			</div>
		));
	}

	return <div className={classes.root}>
		{ children }
		{/* <Text size={400}>B: {state.beatIndex}/{beatsCount}, N: {state.noteIndex}/{options.beatDivider}, A: {state.accent}</Text> */}
	</div>
});
