import { useRef } from "react";
import { input } from "../controllers/input";
import { interact } from "../interactions/actions";
import { useGame } from "../state/game";
export function MobileControls() {
  const knob = useRef<HTMLDivElement>(null!),
    pointer = useRef(-1);
  const s = useGame();
  function reset() {
    pointer.current = -1;
    input.stick.x = 0;
    input.stick.z = 0;
    knob.current.style.transform = "translate(0px,0px)";
  }
  if (!s.entered || s.paused || s.sign) return null;
  return (
    <div className="mobile-controls">
      <div
        className="joystick"
        role="region"
        aria-label="Movement joystick"
        onPointerDown={(e) => {
          e.preventDefault();
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (pointer.current !== e.pointerId) return;
          const rect = e.currentTarget.getBoundingClientRect();
          let x = e.clientX - rect.left - rect.width / 2,
            z = e.clientY - rect.top - rect.height / 2;
          const length = Math.hypot(x, z);
          if (length > 36) {
            x *= 36 / length;
            z *= 36 / length;
          }
          input.stick.x = x / 36;
          input.stick.z = z / 36;
          knob.current.style.transform = `translate(${x}px,${z}px)`;
        }}
        onPointerUp={reset}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
      >
        <div className="joystick-knob" ref={knob} />
      </div>
      <div className="touch-actions">
        <button
          className={input.run ? "active" : ""}
          onPointerDown={(e) => {
            input.run = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={() => (input.run = false)}
          onPointerCancel={() => (input.run = false)}
          onLostPointerCapture={() => (input.run = false)}
        >
          Run
        </button>
        <button onClick={interact} disabled={!s.near && !s.seat}>
          {s.seat ? "Stand" : "Interact"}
        </button>
      </div>
    </div>
  );
}
