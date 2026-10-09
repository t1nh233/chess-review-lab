export function PlayerBar({ name, rating, color, accuracy }: { name: string; rating?: number; color: "white" | "black"; accuracy?: number }) {
  return <div className={`player-bar player-${color}`}>
    <span className="player-swatch" aria-hidden="true"/>
    <strong>{name}</strong>{rating ? <small>({rating})</small> : null}
    {accuracy !== undefined && <span className="player-accuracy" title="Estimated Accuracy">{accuracy.toFixed(1)}</span>}
  </div>;
}
