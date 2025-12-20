import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FormControlProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
  ExtraProps extends Record<string, unknown> = Record<never, never>,
> = {
  name: TName;
  label: React.ReactNode;
  description?: React.ReactNode;
  control: ControllerProps<TFieldValues, TName, TTransformedValues>["control"];
  inputProps?: ExtraProps;
};

type FormBaseProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
  ExtraProps extends Record<string, unknown> = Record<never, never>,
> = FormControlProps<TFieldValues, TName, TTransformedValues, ExtraProps> & {
  horizontal?: boolean;
  controlFirst?: boolean;
  inputProps?: ExtraProps;
  children: (
    field: Parameters<
      ControllerProps<TFieldValues, TName, TTransformedValues>["render"]
    >[0]["field"] & {
      "aria-invalid": boolean;
      id: string;
    },
    props?: ExtraProps,
  ) => React.ReactNode;
};

type FormControlFunc<
  ExtraProps extends Record<string, unknown> = Record<never, never>,
> = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(
  props: FormControlProps<TFieldValues, TName, TTransformedValues, ExtraProps>,
) => React.ReactNode;

function FormBase<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
  ExtraProps extends Record<string, unknown> = Record<never, never>,
>({
  children,
  control,
  label,
  name,
  description,
  controlFirst,
  horizontal,
  inputProps,
}: FormBaseProps<TFieldValues, TName, TTransformedValues, ExtraProps>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const labelElement = (
          <>
            <FieldLabel htmlFor={field.name} className="w-full">
              {label}
            </FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </>
        );
        const control = children(
          {
            ...field,
            id: field.name,
            "aria-invalid": fieldState.invalid,
          },
          inputProps,
        );
        const errorElem = fieldState.invalid && (
          <FieldError errors={[fieldState.error]} />
        );

        return (
          <Field
            data-invalid={fieldState.invalid}
            orientation={horizontal ? "horizontal" : undefined}
          >
            {controlFirst ? (
              <>
                {control}
                <FieldContent>
                  {labelElement}
                  {errorElem}
                </FieldContent>
              </>
            ) : (
              <>
                <FieldContent>{labelElement}</FieldContent>
                {control}
                {errorElem}
              </>
            )}
          </Field>
        );
      }}
    />
  );
}

type FormInputProps = {
  placeholder?: string;
  autoComplete?: React.InputHTMLAttributes<HTMLInputElement>["autoComplete"];
};

export const FormInput: FormControlFunc<FormInputProps> = (props) => {
  return (
    <FormBase {...props}>
      {(field, inputProps) => <Input {...field} {...inputProps} />}
    </FormBase>
  );
};

export const FormPasswordInput: FormControlFunc<FormInputProps> = (props) => {
  return (
    <FormBase {...props}>
      {(field, inputProps) => <PasswordInput {...field} {...inputProps} />}
    </FormBase>
  );
};

export const FormNumberInput: FormControlFunc<FormInputProps> = (props) => {
  return (
    <FormBase {...props}>
      {(field, inputProps) => <NumberInput {...field} {...inputProps} />}
    </FormBase>
  );
};

export const FormTextarea: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Textarea {...field} />}</FormBase>;
};

export const FormSelect: FormControlFunc<{
  children: React.ReactNode;
  placeholder?: string;
}> = (props) => {
  return (
    <FormBase {...props}>
      {({ onChange, onBlur, ...field }, inputProps) => (
        <Select {...field} onValueChange={onChange}>
          <SelectTrigger
            aria-invalid={field["aria-invalid"]}
            id={field.id}
            onBlur={onBlur}
          >
            <SelectValue placeholder={inputProps?.placeholder} />
          </SelectTrigger>
          <SelectContent>{inputProps?.children}</SelectContent>
        </Select>
      )}
    </FormBase>
  );
};

export const FormCheckbox: FormControlFunc = (props) => {
  return (
    <FormBase {...props} horizontal controlFirst>
      {({ onChange, value, ...field }) => (
        <Checkbox {...field} checked={value} onCheckedChange={onChange} />
      )}
    </FormBase>
  );
};
