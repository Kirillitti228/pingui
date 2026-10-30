import React from "react";

export default function Penguin({ small = false, state = "idle", label = "Pingi the penguin" }) {
  return (
    <div className={`penguin penguin-${state}${small ? " penguin-small" : ""}`} data-state={state} role="img" aria-label={label}>
      <div className="penguin-body">
        <span className="penguin-wing wing-left" />
        <span className="penguin-wing wing-right" />
        <span className="penguin-eye eye-left" />
        <span className="penguin-eye eye-right" />
        <span className="penguin-brow brow-left" />
        <span className="penguin-brow brow-right" />
        <span className="penguin-beak" />
        <span className="penguin-belly" />
        <span className="penguin-foot foot-left" />
        <span className="penguin-foot foot-right" />
        <span className="penguin-book">📖</span>
      </div>
      <span className="penguin-sparkle">✦</span>
    </div>
  );
}
