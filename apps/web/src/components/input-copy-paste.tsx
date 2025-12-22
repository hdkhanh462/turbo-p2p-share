import { CheckIcon, ClipboardIcon, CopyIcon, XIcon } from "lucide-react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type Props = React.ComponentProps<typeof InputGroupInput> & {
	showCopy?: boolean;
	showPaste?: boolean;
	showClear?: boolean;
};

export const InputCopyPaste = ({
	value,
	showCopy = true,
	showPaste,
	showClear,
	onChange,
	...props
}: Props) => {
	const { copyToClipboard, isCopied } = useCopyToClipboard();
	const handleCopy = () => {
		if (!value) return;
		copyToClipboard(value.toString());
	};

	const handlePaste = async () => {
		if (!onChange) return;

		try {
			const text = await navigator.clipboard.readText();
			onChange({
				target: { value: text },
			} as React.ChangeEvent<HTMLInputElement>);
		} catch (err) {
			console.error("Paste failed", err);
		}
	};

	const handleClear = () => {
		if (!onChange) return;

		onChange({
			target: { value: "" },
		} as React.ChangeEvent<HTMLInputElement>);
	};

	return (
		<InputGroup>
			<InputGroupInput value={value} onChange={onChange} {...props} />
			{showCopy && (
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						aria-label="Copy"
						title="Copy"
						size="icon-xs"
						disabled={!value}
						onClick={handleCopy}
					>
						{isCopied ? <CheckIcon /> : <CopyIcon />}
					</InputGroupButton>
				</InputGroupAddon>
			)}
			{showPaste && (
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						aria-label="Paste"
						title="Paste"
						size="icon-xs"
						onClick={handlePaste}
					>
						<ClipboardIcon />
					</InputGroupButton>
				</InputGroupAddon>
			)}
			{showClear && value && (
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						aria-label="Clear"
						title="Clear"
						size="icon-xs"
						onClick={handleClear}
					>
						<XIcon />
					</InputGroupButton>
				</InputGroupAddon>
			)}
		</InputGroup>
	);
};
