function getUserInitial(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || '?';
  return source.charAt(0).toUpperCase();
}

type AvatarProps = {
  name?: string | null;
  email?: string | null;
};

export default function Avatar({ name, email }: AvatarProps) {
  return (
    <span
      className="bg-brand text-brand-foreground ring-border flex size-8 items-center justify-center rounded-full text-sm font-medium ring-1"
      aria-hidden
    >
      {getUserInitial(name, email)}
    </span>
  );
}
