import { nanoid } from "nanoid";

type RandomTextOptions = {
	length?: number;
	prefix?: string;
};

const DEFAULT_OPTIONS: Required<Pick<RandomTextOptions, "length">> = {
	length: 5,
};

export function randomText(options?: RandomTextOptions) {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	return `${opts.prefix}_${nanoid(opts.length)}`;
}
