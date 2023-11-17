import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { ClickEventHandler, Metronome as MetronomeCore, MetronomeOptions, getFullOptions } from "../metronome";
import { MetronomeDuration } from "../metronome/core";
import { Button, Card, GriffelStyle, Text, makeStyles, mergeClasses, shorthands, tokens } from "@fluentui/react-components";
import { ArrowResetFilled, PauseFilled, PlayFilled, StopFilled } from "@fluentui/react-icons";
import { BasicEvent, EventControl } from "../Event";
import { useInitializedRef } from "./reactHelpers";


export interface MetronomeProps {
	options?: Partial<MetronomeOptions>,
	duration?: MetronomeDuration,
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


export const Metronome = React.memo(function (props: MetronomeProps) {

	const { core, clickEvent } = useInitializedRef(() => ({
		core: new MetronomeCore(),
		clickEvent: new EventControl<[number, number, number]>(),
	})).current;

	useEffect(() => {
		return () => core.stop();
	}, []);

	const { duration, options: corePartialOptions, onStateChanged, resetToken } = props;

	const coreOptions = useMemo(
		() => getFullOptions({ ...corePartialOptions }),
		[corePartialOptions]
	);

	const [state, setState] = useState(MetronomeState.Stopped);

	useLayoutEffect(() => {
		core.update(coreOptions);
	}, [coreOptions]);

	const onFinishedRef = useRef<() => void>();

	onFinishedRef.current = useCallback(() => {
		clickEvent.invoke(-1, 0, 0);
		setState(MetronomeState.Paused);
		onStateChanged?.(MetronomeState.Finished);
	}, [onStateChanged]);

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
				duration,
				(beatIndex, noteIndex, accent) => clickEvent.invoke(beatIndex, noteIndex, accent),
				() => onFinishedRef.current!()
			);
			setState(MetronomeState.Playing);
			onStateChanged?.(MetronomeState.Playing);
		}
	}, [state, duration, onStateChanged]);

	const onResetClick = useCallback(() => {
		core.stop();
		clickEvent.invoke(-1, 0, 0);
		setState(MetronomeState.Stopped);
		onStateChanged?.(MetronomeState.Stopped);
	}, [onStateChanged]);

	useLayoutEffect(() => {
		onResetClick();
	}, [resetToken]);



	const classes = useClasses();

	return <Card className={classes.card}>
		<div className={classes.root}>

			<div className={classes.bpmSection}>
				<div>
					<Text size={600} weight="semibold">{coreOptions.bpm}</Text>
					<Text size={300}> bpm</Text>
				</div>
				<div>
					<Text size={400} align="center">{coreOptions.signature[0]}/{coreOptions.signature[1]}</Text>
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
					<ClickView options={coreOptions} clickEvent={clickEvent} />
				</div>

				<div className={classes.clickSectionBottom}>
					<div className={classes.elapsedViewContainer}>
						<ElapsedView core={core} clickEvent={clickEvent} duration={duration} />
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

const ElapsedView = React.memo(function({ core, clickEvent, duration }: {
	core: MetronomeCore,
	clickEvent: BasicEvent,
	duration?: MetronomeDuration,
}) {

	const classes = useElapsedViewClasses();
	const [position, setPosition] = useState<PositionState>({ elapsedMeasures: 0, elapsedSeconds: 0, elapsedParts: 0 });

	useLayoutEffect(() => {
		const handler = () => {
			setPosition({ elapsedMeasures: core.elapsedMeasures, elapsedSeconds: core.elapsedSeconds, elapsedParts: core.elapsedChunks });
		};
		clickEvent.add(handler);
		return () => clickEvent.remove(handler);
	}, []);

	const totalDuration = useMemo(() => {
		if (!duration) return -1;
		return duration.chunks.reduce((sum, v) => sum + v, 0);
	}, [duration]);

	return <div className={classes.root}>
		{ duration && duration.chunks.length > 1 && (
			<Text size={400}>
				part: {Math.min(position.elapsedParts + 1, duration.chunks.length)}/{duration.chunks.length}
			</Text>
		)}

		<Text size={400}>
			bars: {position.elapsedMeasures}{ duration?.units === "measures" && ("/" + totalDuration) }
		</Text>
		<Text size={400}>
			{formatTime(position.elapsedSeconds)}{ duration?.units === "seconds" && ("/" + formatTime(totalDuration)) }
		</Text>
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
	clickEvent: BasicEvent<[number, number, number]>,
	options: MetronomeOptions,
}) {

	const [state, setState] = useState({ beatIndex: -1, noteIndex: 0, accent: 0 });
	const classes = useClickViewClasses();
	const accentClasses = useAccentClasses();

	useLayoutEffect(() => {
		const handler: ClickEventHandler = (beatIndex, noteIndex, accent) => {
			setState({ beatIndex, noteIndex, accent });
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
