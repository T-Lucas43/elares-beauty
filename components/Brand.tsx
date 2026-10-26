export default function Brand({
  light = false,
  compact = false,
}: {
  light?: boolean;
  compact?: boolean;
}) {
  return (
    <img
      className={"elares-brand" + (compact ? " compact" : "")}
      src={`/brand/elares-beauty-${light ? "light" : "dark"}.svg`}
      width={220}
      height={58}
      alt="Elares Beauty"
    />
  );
}
