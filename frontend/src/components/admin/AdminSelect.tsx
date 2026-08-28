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
};

export function AdminSelect({
  name,
  label,
  items,
  isRequired,
  defaultValue,
  placeholder,
}: AdminSelectProps) {
  return (
    <Select
      name={name}
      isRequired={isRequired}
      defaultValue={defaultValue}
      placeholder={placeholder}
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
