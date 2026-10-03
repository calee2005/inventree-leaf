type Option = {
  value: string;
  label: string;
};

type Props = {
  label?: string;
  hint?: string;
  value: string;
  placeholder?: string;
  options: Option[];
  onChange: (value: string) => void;
};

export function SelectField({ label, hint, value, placeholder = "未选择", options, onChange }: Props) {
  const control = (
    <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
  if (!label) {
    return control;
  }
  return (
    <label className="field">
      <span>{label}</span>
      {control}
      {hint ? <small className="field-hint">{hint}</small> : null}
    </label>
  );
}
