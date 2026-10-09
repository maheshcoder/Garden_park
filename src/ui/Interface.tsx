import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Avatar } from "../avatar/Avatar";
import { BENCHES, OUTFITS, SIGNS } from "../config/park";
import { game, useGame } from "../state/game";
import { startAudio } from "../audio/ambience";
import { clearInput } from "../controllers/input";
import { interact, respawn } from "../interactions/actions";
import { Dialog } from "./Dialog";
import { MobileControls } from "./MobileControls";
function FlowerLogo() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <g fill="currentColor">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse
            key={r}
            cx="24"
            cy="15"
            rx="7"
            ry="11"
            transform={`rotate(${r} 24 24)`}
          />
        ))}
      </g>
      <circle cx="24" cy="24" r="4" fill="#f6efdb" />
    </svg>
  );
}
function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? (
        <path d="m16 9 6 6m0-6-6 6" />
      ) : (
        <>
          <path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
        </>
      )}
    </svg>
  );
}
function OutfitChoices({ outfit }: { outfit: number }) {
  return (
    <fieldset>
      <legend>Choose your jacket</legend>
      <div className="outfits">
        {OUTFITS.map((o, i) => (
          <button
            key={o.name}
            type="button"
            className={`outfit ${i === outfit ? "selected" : ""}`}
            aria-pressed={i === outfit}
            aria-label={`${o.name} outfit`}
            onClick={() => game.settings({ outfit: i })}
          >
            <span style={{ background: o.jacket }} />
            {o.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function Interface() {
  const s = useGame();
  const [map, setMap] = useState(false);
  const closePause = useCallback(() => {
    clearInput();
    game.set({ paused: false });
  }, []);
  const closeSign = useCallback(() => game.set({ sign: null }), []);
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (s.entered) game.set({ paused: true });
          }}
          aria-label="Blossom Park"
        >
          <FlowerLogo />
          <span>
            blossom park
            <span className="brand-sub">YOUR LITTLE SPRING ADVENTURE</span>
          </span>
        </a>
        <div className="header-actions">
          <span className="season">
            <i /> Spring, at your own pace
          </span>
          <button
            className="icon-button"
            aria-label={s.settings.muted ? "Unmute sound" : "Mute sound"}
            title={s.settings.muted ? "Unmute sound" : "Mute sound"}
            onClick={() => {
              if (s.entered) startAudio();
              game.settings({ muted: !s.settings.muted });
            }}
          >
            <SoundIcon muted={s.settings.muted} />
          </button>
          <button
            className="icon-button"
            aria-label="Open settings"
            title="Settings"
            onClick={() => {
              clearInput();
              game.set({ paused: true });
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 17h16" />
              <circle cx="9" cy="7" r="3" fill="#f6f3e9" />
              <circle cx="15" cy="17" r="3" fill="#f6f3e9" />
            </svg>
          </button>
        </div>
      </header>
      {!s.entered && (
        <main className="entry">
          <div className="eyebrow">
            <span /> A SMALL WORLD. A SLOWER DAY.
          </div>
          <h1>
            Blossom
            <br />
            <em>Park.</em>
            <span className="title-flower" aria-hidden="true">
              ✿
            </span>
          </h1>
          <p className="intro">
            A little wander. A few new wings.
            <br />A whole afternoon that belongs to you.
          </p>
          <form
            className="entry-card panel"
            onSubmit={(e) => {
              e.preventDefault();
              if (!s.ready) return;
              startAudio();
              clearInput();
              game.settings({ name: s.settings.name.trim() || "Wanderer" });
              game.set({ entered: true, paused: false });
            }}
          >
            <div
              className="avatar-preview"
              aria-label={`Avatar wearing the ${OUTFITS[s.settings.outfit].name} outfit`}
            >
              <Canvas
                camera={{ position: [0, 0.3, 3.3], fov: 37 }}
                dpr={[1, 1.35]}
              >
                <ambientLight intensity={0.6} />
                <directionalLight position={[-3, 5, 4]} intensity={2.1} />
                <group position={[0, -0.9, 0]} rotation={[0, -0.28, 0]}>
                  <Avatar outfit={s.settings.outfit} preview />
                </group>
              </Canvas>
              <span>YOUR PARK EXPLORER</span>
            </div>
            <div className="entry-fields">
              <label htmlFor="display-name">What should we call you?</label>
              <input
                id="display-name"
                placeholder="Your name"
                maxLength={24}
                value={s.settings.name}
                onChange={(e) => game.settings({ name: e.target.value })}
                autoComplete="nickname"
              />
              <OutfitChoices outfit={s.settings.outfit} />
            </div>
            <button
              className="primary enter-button"
              type="submit"
              disabled={!s.ready}
            >
              {s.ready ? "Enter the park" : "Preparing your park…"}
              <span aria-hidden="true">↗</span>
            </button>
            <p className="entry-note">
              Wander · Sit · Wave · Find your favorite corner.
            </p>
          </form>
          <div className="entry-footer">
            <span className="leaf">❧</span> A peaceful place. An open
            invitation.
          </div>
        </main>
      )}
      {!s.ready && (
        <div className="loading" role="status">
          <span className="spinner" /> Growing a little world…
        </div>
      )}
      {s.entered && (
        <>
          <div className="location">
            <span className="location-dot" />
            {s.zone}
            <span> / BLOSSOM PARK</span>
          </div>
          <div className="bottom-bar">
            <div className="player-card panel">
              <div
                className="player-initial"
                style={{ background: OUTFITS[s.settings.outfit].jacket }}
              >
                {s.settings.name[0]?.toUpperCase() || "W"}
              </div>
              <div>
                <strong>{s.settings.name}</strong>
                <span>PARK EXPLORER</span>
              </div>
            </div>
            <div className="desktop-hint panel">
              <span>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> wander
              </span>
              <span>
                <kbd>⇧</kbd> run
              </span>
              <span>Drag to look · Scroll to zoom</span>
            </div>
            <div className="bottom-actions">
              <button
                className="pill panel"
                onClick={() => game.set({ wave: s.wave + 1 })}
                disabled={!!s.seat || s.paused || !!s.sign}
              >
                ✧ <span>Wave</span>
              </button>
              <button
                className="pill panel"
                onClick={() => setMap(!map)}
                aria-expanded={map}
              >
                ⌘ <span>Park map</span>
              </button>
            </div>
          </div>
          {(s.near || s.seat) && !s.paused && !s.sign && (
            <button className="interaction panel" onClick={interact}>
              <kbd>E</kbd>
              {s.seat
                ? "Stand up"
                : BENCHES.some((b) => b.id === s.near)
                  ? "Sit for a moment"
                  : `Read ${SIGNS.find((sign) => sign.id === s.near)
                      ?.tag.split("/ ")[1]
                      .toLowerCase()}`}
            </button>
          )}
          <MobileControls />
          {map && (
            <div className="map-panel panel">
              <button
                className="close icon-button"
                aria-label="Close park map"
                onClick={() => setMap(false)}
              >
                ×
              </button>
              <div className="eyebrow">A LITTLE LOOK AROUND</div>
              <h2>Six places to pause.</h2>
              <svg
                viewBox="0 0 220 210"
                role="img"
                aria-label="Park map: entrance south, central plaza in the middle, grove west, flowers east, pond northeast and birds northwest"
              >
                <rect
                  x="5"
                  y="5"
                  width="210"
                  height="200"
                  rx="25"
                  fill="#dce4ca"
                />
                <path
                  d="M110 183 110 110Q185 155 165 95L165 38Q58 10 38 92T110 183"
                  fill="none"
                  stroke="#faf2dc"
                  strokeWidth="14"
                />
                <ellipse cx="165" cy="68" rx="26" ry="23" fill="#94bab4" />
                <path d="M164 37v60" stroke="#bd9e76" strokeWidth="8" />
                {[
                  [110, 183, "Entrance"],
                  [110, 110, "Plaza"],
                  [38, 105, "Grove"],
                  [178, 152, "Flowers"],
                  [180, 32, "Pond"],
                  [65, 35, "Birds"],
                ].map(([x, y, label]) => (
                  <g key={String(label)}>
                    <circle cx={x} cy={y} r="4" fill="#a57e89" />
                    <text
                      x={x}
                      y={Number(y) - 10}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#415541"
                    >
                      {label}
                    </text>
                  </g>
                ))}
              </svg>
              <p>The cream path loops around the park.</p>
            </div>
          )}
        </>
      )}
      {!s.entered && (
        <div className="scene-caption">
          <span className="caption-line" /> SIX LITTLE PLACES TO DISCOVER
          <span>There’s a whole little world out there.</span>
        </div>
      )}
      {s.paused && (
        <Dialog title="Park settings" onClose={closePause}>
          <div className="eyebrow">TAKE YOUR TIME</div>
          <h2>A moment to pause.</h2>
          <p className="muted">Make the park feel right for you.</p>
          <OutfitChoices outfit={s.settings.outfit} />
          <div className="settings-row">
            <label htmlFor="quality">Visual quality</label>
            <select
              id="quality"
              value={s.settings.quality}
              onChange={(e) =>
                game.settings({
                  quality: e.target.value as "low" | "medium" | "high",
                })
              }
            >
              <option value="low">Low · lighter on your device</option>
              <option value="medium">Medium · a little of everything</option>
              <option value="high">High · all the blossoms</option>
            </select>
          </div>

          <div className="settings-row">
            <label htmlFor="volume">
              Nature volume <span>{Math.round(s.settings.volume * 100)}%</span>
            </label>
            <input
              id="volume"
              type="range"
              min="0"
              max="1"
              step=".01"
              value={s.settings.volume}
              onChange={(e) =>
                game.settings({ volume: Number(e.target.value) })
              }
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={s.settings.muted}
              onChange={(e) => game.settings({ muted: e.target.checked })}
            />{" "}
            Mute nature sounds
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={s.settings.reducedMotion}
              onChange={(e) =>
                game.settings({ reducedMotion: e.target.checked })
              }
            />{" "}
            Reduce decorative motion
          </label>
          <div className="menu-controls">
            WASD / arrows to wander · Shift to run
            <br />
            Drag to look · Scroll to zoom · E to interact
            <br />
            On touch: left joystick, drag the world to look.
          </div>
          <button className="primary full" onClick={closePause}>
            {s.entered ? "Back to the park" : "Back to your little you"}
            <span>↗</span>
          </button>
          {s.entered && (
            <button className="text-button full" onClick={respawn}>
              Return to the entrance
            </button>
          )}
        </Dialog>
      )}
      {s.sign && (
        <Dialog title={s.sign.title} onClose={closeSign}>
          <div className="eyebrow">{s.sign.tag}</div>
          <div className="sign-flower">
            <FlowerLogo />
          </div>
          <h2>{s.sign.title}</h2>
          <p className="sign-copy">{s.sign.text}</p>
          <button className="primary full" onClick={closeSign}>
            Keep wandering <span>↗</span>
          </button>
        </Dialog>
      )}
    </>
  );
}
