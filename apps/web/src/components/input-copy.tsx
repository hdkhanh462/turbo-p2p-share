import { CheckIcon, CopyIcon } from "lucide-react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

type Props = React.ComponentProps<typeof InputGroupInput>;

export const InputCopy = ({ ...props }: Props) => {
	const { copyToClipboard, isCopied } = useCopyToClipboard();
	const handlerCopy = () => {
		if (!props.value) return;
		copyToClipboard(props.value.toString());
	};

	return (
		<InputGroup>
			<InputGroupInput {...props} />
			<InputGroupAddon align="inline-end">
				<InputGroupButton
					aria-label="Copy"
					title="Copy"
					size="icon-xs"
					onClick={handlerCopy}
				>
					{isCopied ? <CheckIcon /> : <CopyIcon />}
				</InputGroupButton>
			</InputGroupAddon>
		</InputGroup>
	);
};
