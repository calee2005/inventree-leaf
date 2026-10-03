import { forwardRef, type InputHTMLAttributes } from "react";

type Props = {
  label?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "search" | "url" | "password";
  variant?: "field" | "search";
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "inputMode" | "placeholder" | "autoComplete" | "enterKeyHint" | "onFocus"
>;

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, hint, value, onChange, type = "text", variant = "field", ...rest },
  ref,
) {
  const secret = type === "password";
  const input = (
    <input
      {...rest}
      ref={ref}
      className={variant === "search" ? "field-input is-search" : "field-input"}
      type={variant === "search" ? "search" : type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoCapitalize={secret ? "none" : undefined}
      autoCorrect={secret ? "off" : undefined}
      spellCheck={secret ? false : undefined}
    />
  );
  if (!label) {
    return input;
  }
  return (
    <label className="field">
      <span>{label}</span>
      {input}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
});
