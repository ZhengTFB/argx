<div align="center">

<img src="design/logo.svg" width="320" alt="ARGX">

**Turn your room into an escape room.**

A protocol and SDK that let a web page drive real-world hardware — lights, sound, vibration, relays — over a USB serial line.

[![tests](https://github.com/ZhengTFB/argx/actions/workflows/test.yml/badge.svg)](https://github.com/ZhengTFB/argx/actions/workflows/test.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![protocol](https://img.shields.io/badge/protocol-v1-blue.svg)](protocol/PROTOCOL.md)
[![website](https://img.shields.io/badge/website-online-brightgreen.svg)](https://zhengtfb.github.io/argx/)
![dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/ZhengTFB/argx/issues)

**English** ｜ [简体中文](README.zh-CN.md)

</div>

> Hardware side (wiring, pins, build and flash, debugging) lives in another repository → **[argx-esp32](https://github.com/ZhengTFB/argx-esp32)**
>
> Letting an AI assistant integrate ARGX into a page you already wrote → **[argx-skill](https://github.com/ZhengTFB/argx-skill)** (or read [`guide/ai-skill.md`](guide/ai-skill.md))

---

## What it is

ARG (alternate reality game) works when the story spills out of the screen. Players are not just reading a plot — they feel it happening around them. The last step has always been missing: the lights, the sounds, the drawers in the player's room do not move with the story.

The usual approach builds one set of hardware for one game. Script and hardware are welded together, so the next story needs new hardware.

ARGX supplies the layer in between. It is not a device and it is not a game; it is the line between them.

> A film is the story. Speakers are the hardware. This project is the standard audio cable.
> With a standard cable, any film can use any speaker, and neither side has to change for the other.

Concretely, it gives you three things:

- **A protocol** ([`protocol/PROTOCOL.md`](protocol/PROTOCOL.md)) — one JSON object per line, both ends equal
- **A web SDK** ([`sdk/`](sdk/)) — zero dependencies, plain JavaScript, paste it into a single-file HTML project
- **A console** ([`console/`](console/)) — connect, self-test, simulate, debug and read the docs in one page

## The three roles

| Role | What they know | What they get |
|---|---|---|
| **Creator** | Writes stories, not firmware. Usually lets an AI write the code | One call, `ARGX.fire('reveal')`, and the room follows the story. No microcontrollers, no drivers |
| **Player** | Wants a stronger experience, does not want to configure anything | Buy a device, plug in USB, click connect. Without a device the whole game still plays through |
| **Hardware author** | Builds devices, does not want to write a full communication stack per device | Implement the protocol once and every work can use your device. Adding a capability is one registration line, not a protocol change |

One judgement shaped the whole SDK design:

> **A creator's real client interface is their AI, not the creator.**
>
> Creators do not read documentation. Their workflow is telling an AI "add some atmosphere to this scene".
> So [`sdk/AGENTS.md`](sdk/AGENTS.md) is an integration spec **written for AI assistants**: it teaches
> `ARGX.fire('reveal')` rather than which channel deserves which brightness.

## Architecture

```
        Browser
  ┌───────────────────────┐
  │  Console ／ third-party work │
  └───────────┬───────────┘
              │  SDK: zero dependencies, paste into single-file HTML
              │  Protocol: one JSON object per line
        ┌─────┴─────┐
        │ Transport │   Web Serial ／ Mock (virtual device)
        └─────┬─────┘
              │
  ┌───────────┴───────────┐
  │   ESP32 device (firmware) │
  │  light / sound / vibration / relay │
  └───────────────────────┘
```

Two decisions explain everything else:

**Both ends are peers, not a master and a slave.** The page and the device run the **same session layer** — handshake, heartbeat, ack, reconnect, watchdog — and differ only in which handlers they register. Multi-device and multi-page setups need no structural change, because the protocol is already symmetric.

**The protocol is the single source of truth.** Both implementations derive from `protocol/PROTOCOL.md`. The firmware, the virtual device and the SDK session layer are three implementations of it. Protocol changes start in the document.

## Protocol at a glance

Every frame is one line of JSON, terminated by `\n`. Nothing else is on the wire except `#`-prefixed debug lines, which receivers ignore.

| Field | Meaning |
|---|---|
| `v` | Protocol version. Currently `1` |
| `c` | Command name |
| `id` | Capability id, such as `light.main` (only for `cue`) |
| `p` | Parameter object. All behaviour lives here; the top level is routing only |
| `seq` | Sequence number, used to pair a command with its `ack` |
| `dev` | Device id |

A capability is an output or input object addressed by id (`light.main`, `sound.beeper`, `motion.vibrate`, `env.relay`). The device declares which ones it has:

```json
{"v":1,"c":"ready","dev":"ARGX-0001","proto":1,
 "caps":{"out":["light.main","sound.beeper","motion.vibrate","env.relay"],
         "in":[]}}
```

A minimal complete round trip — the page asks the light to fade to 80% over 800ms, the device confirms:

```
→ {"v":1,"c":"cue","id":"light.main","seq":12,"p":{"i":0.8,"dur":3000,"ramp":800,"pri":2}}
← {"v":1,"c":"ack","seq":12,"r":"applied"}
```

Commands run both ways. The page sends `hello` `cue` `batch` `query` `cfg` `ping` `reset`; the device sends `ready` `ack` `state` `input` `pong` `err`. Nothing in the protocol is reserved to one side.

The five cue parameters:

| Parameter | Type | Default | Meaning |
|---|---|---|---|
| `i` | 0 ~ 1 | 1.0 | Intensity. Out-of-range values are clamped, not rejected |
| `dur` | integer ms | 30000 | Duration. 30000 is also the ceiling |
| `ramp` | integer ms | 0 | Fade-in time. Clamped to `dur` if longer |
| `pri` | 0 ~ 3 | 2 | Priority. **Lower is stronger** |
| `hold` | true / false | false | Stay on, ignoring `dur`, until preempted or reset |

The fixed numbers:

| Item | Value |
|---|---|
| Frame delimiter | `\n` (`\r\n` tolerated) |
| Maximum frame | 512 bytes |
| Heartbeat | 3000 ms, sent by the page |
| Declared lost | 10000 ms without a `pong` |
| Watchdog | 15000 ms without any valid frame; the device clears all output |
| Maximum effect | 30000 ms, `hold` excepted |
| Maximum `batch` | 8 cues |

Every processed cue gets an `ack` carrying `r` — `applied`, `preempted`, `dup` or `dropped`. An `ack` that says "received but not run" is the difference between a quiet device and a broken link.

## Why it is built this way

**One JSON object per line.** It is readable, it can be `tee`'d, and you can debug it by eye. When something breaks you see `{"c":"cue","id":"light.main","p":{"i":0.4}}` instead of bytes that need decoding. The cost is a few more bytes per frame; the benefit is that serial debugging stops being the hard part of the project.

**Both ends are peers.** See above. The cost is that each end implements the session layer. The benefit is that multi-device and multi-page setups need no redesign.

**The protocol is the foundation, not the SDK.** The SDK is one convenience layer over it. A creator using the SDK, a creator writing raw frames, and a firmware author implementing the device side all work against the same document — so a new language or platform only needs a new implementation, not a new spec.

**The SDK has zero dependencies and fits in a single file.** Most creator projects are one HTML file produced by an AI. Any build step or `npm install` breaks at exactly that point. `sdk/argx.js` is one file of plain JavaScript loaded with `<script src>`.

**Degrading beats failing.** No hardware, failed connection, a `file://` page: every call **succeeds silently**. Cues go to the console log and the story continues. Nothing throws, nothing pops a dialog, nothing blocks the plot. The device performs; game logic never depends on it.

**Capabilities are registered, not enumerated.** Adding an output means registering a capability id on the device side and declaring its parameters. The protocol has no `switch(id)` and no hard-coded feature list, so new hardware needs no protocol change and no SDK change.

**Semantic cues only, never pin levels.** The page says "light to 40%", not "GPIO4 to PWM 102". Which pin holds what is the device's business — that is why swapping boards does not require touching a work.

## Getting started

### Just look

- Landing page: <https://zhengtfb.github.io/argx/>
- Console: <https://zhengtfb.github.io/argx/console/>

The console ships with a **built-in virtual device**, so you can play a work end to end without buying anything.

> The console on GitHub Pages talks to **your own computer's USB port**, not the server's.
> Web Serial requires HTTPS or `localhost`; Pages is HTTPS, so it works. Port enumeration and
> authorisation happen between the visitor's browser and the visitor's computer: you open the
> page, plug in your ESP32, click connect.

### Just run it (no hardware)

```bash
git clone https://github.com/ZhengTFB/argx.git
cd argx

# Four gates. Zero dependencies, nothing to install.
node tests/run.js            # protocol conformance      22 scenarios / 213 checks
node tests/sdk_smoke.js      # SDK against the virtual device      23 checks
node tests/agents_guide.js   # run the AGENTS.md snippet as written 12 checks
node tests/demo_smoke.mjs    # demo end to end                     31 checks

# Start the console (needs Node 20.19+ / 22.12+)
cd console
npm install
npm run dev                  # http://localhost:5173
```

The console connects to the virtual device on its own. The simulator page fires all four outputs and shows them, the device page runs a self-test, and the debug page sends cues by hand and shows the acks.

To preview what a deployment looks like:

```bash
cd console && npm run build && cd ..
node tools/site.mjs --serve          # http://localhost:4173/argx/
node tools/site.mjs --check          # headless browser walk-through, scans for 404s and exceptions
```

### Connect real hardware

The hardware side — wiring, pins, building, flashing, troubleshooting — is a separate repository:

**→ [`argx-esp32`](https://github.com/ZhengTFB/argx-esp32)**

[`firmware/`](firmware/) here is a copy of the same source, so the protocol and the firmware can be read side by side.

### Let an AI do the integration

**[`argx-skill`](https://github.com/ZhengTFB/argx-skill)** is a self-contained skill package for the AI assistant of someone who already has an ARG page. It reads the page, proposes where the story beats should move the room, makes the changes, verifies its own work against a ten-item checklist, and hands back the files.

It ships with the protocol, the full SDK API, the event vocabulary, the parameter table, the error codes and the constants — so the assistant never has to look anything up in this repository.

You do not have to read any of it. Hand the repository to the assistant and ask it to integrate ARGX.

## Repository layout

```
argx/
├── protocol/      Protocol spec. The single source of truth. Both implementations derive from it
├── firmware/      ESP32 firmware (Arduino C++): session layer, capability layer, entry point
├── device/        Virtual device. The protocol's second implementation, and the simulator's base
├── tests/         Standard frame sequences (frames.json) and the scripts that run them
├── sdk/           Web SDK: zero dependencies, plain JS, plus AGENTS.md (the AI-facing spec)
├── demo/          A minimal example work. The console's library reads the same script
├── console/       Console (Vite + React + TS). The simulator imports device/, never copies it
├── landing/       Landing page. Zero build, plain HTML/CSS/JS
├── guide/         User-facing documentation. The only place the prose lives; the console's
│                  documentation page is generated from it
├── design/        Interface source of truth: prototypes, six design documents, tokens.css
├── tools/         Release tooling: assemble and verify the GitHub Pages site, build guide/
└── docs/          Stage briefs and progress notes (PROGRESS.md records why each decision was made)
```

`CLAUDE.md` is the project charter written for AI assistants — hard constraints, known traps, decision records. If you write code for this project with an AI, start there.

## Development

```bash
node tests/run.js -v              # print the frames received at each step
node tests/run.js --scenario=11   # run only scenarios whose name contains "11"

node tools/build-guide.mjs        # regenerate the console's documentation from guide/*.md
node tools/build-guide.mjs --check  # fail if the generated file and the markdown disagree

cd console
npm run build                     # type check + bundle to dist/ (static)
npm run dev                       # in another terminal
node scripts/smoke.mjs            # console end to end (97 checks, headless browser over DevTools)
```

**Changing the protocol always follows this order:** `protocol/` first, then `firmware/` and `device/`, then `tests/`. Each end has its own implementation, so **changing one means changing the other** — both repositories carry comments pointing at the counterpart.

**Changing the interface follows this order:** read `design/prototype/*.html`, then the matching document in `design/`, and only then edit `console/` or `landing/`. Appearance is governed by `design/`, not by whoever writes the code.

CI runs the gates, the console build and a set of browser checks on every push and pull request — see [`.github/workflows/test.yml`](.github/workflows/test.yml).

## Related repositories

- **[`argx-esp32`](https://github.com/ZhengTFB/argx-esp32)** — the ESP32 adapter: hardware-side implementation, wiring diagram, pin table, bill of materials, build and flash instructions, troubleshooting
- **[`argx-skill`](https://github.com/ZhengTFB/argx-skill)** — the integration skill package for AI assistants

Files that both sides depend on exist as a copy in each repository (the protocol document, the firmware source, the wiring document). There are no submodules.

## License

MIT © 2026 ZhengTFB
