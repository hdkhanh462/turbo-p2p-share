import { nanoid } from "nanoid";

type RandomIdOptions = {
	length?: number;
	prefix?: string;
};

const DEFAULT_OPTIONS = {
	length: 10,
};

export function randomId(options?: RandomIdOptions) {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	return `${opts.prefix}_${nanoid(opts.length)}`;
}
