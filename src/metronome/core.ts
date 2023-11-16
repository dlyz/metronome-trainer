
export type MetronomeDuration = never
| { type: "measures", value: number }
| { type: "seconds", value: number }
;
