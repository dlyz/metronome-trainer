declare module "*.png" {
	const value: any;
	export = value;
}

declare module "adsr-envelope" {
	export default class ADSREnvelope {
		constructor(options?: {
			/** @default 0.01 (10msec) */
			attackTime?: number;
			/** @default: 0.3 (300msec) */
			decayTime?: number;
			/** @default 0.5 */
			sustainLevel?: number;
			/** @default 1 (1sec) */
			releaseTime?: number;
			/** @default Infinity */
			gateTime?: number;
			/** */
			sustainTime?: number;
			/** */
			duration?: number;
			/** @default 1 */
			peakLevel?: number;
			/** @default 0.001 */
			epsilon?: number;
			/** @default "lin" */
			attackCurve?: "lin" | "exp";
			/** @default "lin" */
			decayCurve?: "lin" | "exp";
			/** @default "lin" */
			releaseCurve?: "lin" | "exp";
		});

		duration: number;
		attackTime: number;
		decayTime: number;
		sustainTime: number;
		sustainLevel: number;
		releaseTime: number;
		gateTime: number;
		peakLevel: number;
		epsilon: number;
		attackCurve: string;
		decayCurve: string;
		releaseCurve: string;

		valueAt(/** @default 0 */ time?: number): number;
		applyTo(audioParam: AudioParam, /** @default 0 */ playbackTime?: number): this;
		getWebAudioAPIMethods(/** @default 0 */ playbackTime?: number): Array<[]>;
		clone(): ADSREnvelope;
	}
}
