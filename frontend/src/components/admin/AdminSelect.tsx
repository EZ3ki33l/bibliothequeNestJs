import { FieldError, Label, ListBox, Select } from '@heroui/react';

type AdminSelectItem = {
  id: string;
  label: string;
};

type AdminSelectProps = {
  name: string;
  label: string;
  items: AdminSelectItem[];
  isRequired?: boolean;
  defaultValue?: string;
  placeholder?: string;
  /** Prévenu du choix, pour ce qui en dépend ailleurs dans le formulaire (le champ reste non contrôlé). */
  onChange?: (value: string) => void;
};

export function AdminSelect({
  name,
  label,
  items,
  isRequired,
  defaultValue,
  placeholder,
  onChange,
}: AdminSelectProps) {
  return (
    <Select
      name={name}
      isRequired={isRequired}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={onChange ? (value) => onChange(String(value ?? '')) : undefined}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      <FieldError />
    </Select>
  );
}
