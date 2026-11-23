# RoboAshr

A talking robot for Asher's tablet.

- **Copies you:** talk to it and it says your words back in a robot voice, with its jaw chomping along.
- **Answers questions:** start with "Robo…", like "Robo, tell me a joke". It knows jokes, facts, the time and date, math, animal sounds, spelling, counting, coin flips and dice. It can also dance and sing. Answers come from a script, not AI.
- **Asks you questions:** "What's your favorite color?", "Do you have a pet?" and more, and it reacts to your answer. It asks when you say "Robo, ask me a question" or tap ❓, and on its own after a minute of quiet.
- **Scary mode:** say "Robo, scary mode" or tap 👻. The room goes red, its eyes shrink and its voice drops. It asks spooky questions like "Why… did you make me?" and "What… is my purpose?". Say "Robo, be nice" or tap 👻 again to go back.
- **Knows when you're there:** it uses the front camera to notice movement. When nobody's around it falls asleep and its brain timer pauses. Move or talk and it wakes up and says hi.
- **Breaks its brain every 4 minutes:** fix it by putting out sparks, tightening bolts and plugging in wires.

Everything runs in the browser, and nothing is sent to a server:

- **`index.html`:** the whole app.
- **Speech recognition:** done on the device by [vosk-browser](https://github.com/ccoreilly/vosk-browser) (Apache-2.0, `vendor/vosk.js`) with the small English Vosk model (`models/`, 41 MB). It works in the Fire tablet's Silk browser, which has no built-in speech recognition. The model downloads once and is then kept in the browser's cache storage.
- **Robot voice:** answers are spoken by [meSpeak](https://www.masswerk.at/mespeak/) (eSpeak compiled to JavaScript, GNU GPL, `vendor/mespeak.js`). Both voices then go through the same robot effect: a ring modulator, a bit-crusher, a metallic echo and a tinny speaker tone.
- **Camera:** frames are compared on the tablet and never saved or uploaded.

The microphone and camera only work on an `https://` page, which GitHub Pages provides.

## Settings

Add these to the end of the page address, joined with `&`, for example `?name=Asher&away=60`:

- `name=Asher`: the name it greets
- `ask=60`: seconds of quiet before it asks a question on its own (25 in scary mode); `ask=off` turns that off
- `minutes=4`: how long until the brain breaks
- `away=45`: seconds without motion or voice before it falls asleep
- `motion=0.02`: how much movement wakes it (lower is more sensitive)
- `pitch=1.3`: how high the copying voice is
- `sens=1.5`: makes it pick up a quiet voice more easily
- `camera=off`: never uses the camera, never sleeps
- `talk=off`: copy only, no questions
- `grammar=off`: let Vosk hear any English words, not just RoboAshr's commands (much less accurate)
- `speech=browser`: use the browser's own speech recognition instead of Vosk (Chrome only; it sends audio to Google)
- `voice=tablet`: speak answers with the tablet's own voice instead of the robot voice
- `debug`: shows test buttons, a box for typing questions, and a status line showing whether the mic, camera and speech recognition work
