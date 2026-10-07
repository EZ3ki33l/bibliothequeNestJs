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
      className="bg-blueberry text-blacksea-dark font-heading flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      aria-hidden
    >
      {getUserInitial(name, email)}
    </span>
  );
}
