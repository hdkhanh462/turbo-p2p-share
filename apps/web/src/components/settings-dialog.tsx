import { zodResolver } from "@hookform/resolvers/zod";
import { SettingsIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";

import { FormCheckbox, FormNumberInput, FormSlider } from "@/components/form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_APP_SETTINGS, useAppSettings } from "@/hooks/use-app-settings";

const settingsSchema = z.object({
	chunkSize: z.array(z.number()).length(1),
	maxBufferedAmount: z.array(z.number()).length(1),
	maxRetries: z.number(),
	maxConcurrency: z.number(),
	maxFilesSelect: z.number(),
	autoRetry: z.boolean(),
	autoUpload: z.boolean(),
	showSpeed: z.boolean(),
});

type SettingsInput = z.infer<typeof settingsSchema>;

export const SettingsDialog = () => {
	const { appSettings, setAppSettings } = useAppSettings();

	const form = useForm<SettingsInput>({
		resolver: zodResolver(settingsSchema),
		defaultValues: {
			...appSettings,
			chunkSize: [appSettings.chunkSize / 1024],
			maxBufferedAmount: [appSettings.maxBufferedAmount / 1024],
		},
	});

	const onSubmit = (input: SettingsInput) => {
		setAppSettings({
			...input,
			chunkSize: input.chunkSize[0] * 1024,
			maxBufferedAmount: input.maxBufferedAmount[0] * 1024,
		});
		form.reset(input);
	};

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					onClick={(e) => {
						e.currentTarget.blur();
					}}
				>
					<SettingsIcon />
					Settings
				</Button>
			</DialogTrigger>
			<DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Configure your personal application settings below.
					</DialogDescription>
				</DialogHeader>
				<form id="settings-form" onSubmit={form.handleSubmit(onSubmit)}>
					<FieldGroup>
						<div className="grid grid-cols-2 gap-4">
							<FormCheckbox
								control={form.control}
								name="autoUpload"
								label="Auto Upload"
							/>
							<FormCheckbox
								control={form.control}
								name="showSpeed"
								label="Show Speed"
							/>
						</div>
						<Controller
							name="autoRetry"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field
									orientation="horizontal"
									data-invalid={fieldState.invalid}
								>
									<FieldContent>
										<FieldLabel htmlFor={`settings-form-${field.name}`}>
											Auto Retry
										</FieldLabel>
										<FieldDescription>
											Automatically retry failed file transfers.
										</FieldDescription>
									</FieldContent>
									<Switch
										id={`settings-form-${field.name}`}
										name={field.name}
										checked={field.value}
										onCheckedChange={field.onChange}
										aria-invalid={fieldState.invalid}
									/>
								</Field>
							)}
						/>
						<FormNumberInput
							control={form.control}
							name="maxRetries"
							label="Max Retries"
							description="Maximum number of retries per file."
							inputProps={{
								placeholder: "e.g: 5",
								autoComplete: "off",
							}}
						/>
						<div className="grid grid-cols-2 gap-4">
							<FormNumberInput
								control={form.control}
								name="maxConcurrency"
								label="Max Concurrency"
								inputProps={{
									placeholder: "e.g: 5",
									autoComplete: "off",
								}}
							/>
							<FormNumberInput
								control={form.control}
								name="maxFilesSelect"
								label="Max Files Select"
								inputProps={{
									placeholder: "e.g: 5",
									autoComplete: "off",
								}}
							/>
						</div>
						<FormSlider
							control={form.control}
							name="chunkSize"
							label={(value) => `Chunk Size (${value[0]} KB)`}
							inputProps={{
								max: 256,
								step: 16,
							}}
						/>
						<FormSlider
							control={form.control}
							name="maxBufferedAmount"
							label={(value) => `Max Buffered Amount (${value[0]} KB)`}
							inputProps={{
								max: 512,
								step: 16,
							}}
						/>
					</FieldGroup>
				</form>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({
								...DEFAULT_APP_SETTINGS,
								chunkSize: [DEFAULT_APP_SETTINGS.chunkSize / 1024],
								maxBufferedAmount: [
									DEFAULT_APP_SETTINGS.maxBufferedAmount / 1024,
								],
							});
							setAppSettings(DEFAULT_APP_SETTINGS);
						}}
					>
						Reset Defaults
					</Button>
					<Button
						type="submit"
						form="settings-form"
						disabled={!form.formState.isDirty}
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
