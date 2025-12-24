import React, { useState, useEffect } from "react";

export const LoadingDots = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 350);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", height: 10, gap: 1 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: 6 + 6 * (tick % 3 === i ? 1 : 0),
            background: "#fff",
            borderRadius: 3,
            opacity: 0.9,
            transition: "height 0.2s",
          }}
        />
      ))}
    </div>
  );
};
