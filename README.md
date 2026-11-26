# RoboAshr

A talking robot for Asher's tablet.

- **Copies you:** talk to it and it says your words back in a robot voice, with its jaw chomping along.
- **Answers questions:** start with "Robo…", like "Robo, tell me a joke". It knows jokes, facts, the time and date, math, animal sounds, spelling, counting, coin flips and dice. It can also dance and sing. Answers come from a script, not AI.
- **Asks you questions:** "What's your favorite color?", "Do you have a pet?" and more, and it reacts to your answer. It asks when you say "Robo, ask me a question" or tap ❓, and out of nowhere at random moments (every 20–60 seconds, never while someone's talking).
- **Scary mode:** say "Robo, scary mode" or tap 👻. The room goes red, its eyes shrink and its voice drops. It asks spooky questions like "Why… did you make me?" and "What… is my purpose?". Say "Robo, be nice" or tap 👻 again to go back.
- **"Why did you make me?":** sometimes, out of nowhere, the lights go red and RoboAshr asks why you made it. It doesn't understand your first two answers and glitches. After the third it finally gets it: a lightbulb pops up, the red fades, and it says why it was made, using your answer ("You made me to be your friend!"). It's also the first question in scary mode, and you can start it with "Robo, why did I make you?"
- **Ember the dragon (🐉 button):** an original dragon that reacts to you through the front camera. Touching the screen counts as a hand too. There are three modes:
  - **🎓 Training:** reach your hand toward the screen and Ember snarls. Keep your hand there and turn your head away: it calms down, gets curious, then closes its eyes and leans in to touch your hand. Three successes and it trusts you completely.
  - **🛡️ Protective:** Ember guards you. Sudden movement gets a roar and a burst of fire, and if you leave it looks for you.
  - **🥰 Cute:** big round eyes, purring, wants pets, and its eyes follow your face.

  Tap 🤖 to go back to RoboAshr.
- **Knows when you're there:** it uses the front camera to notice movement. When nobody's around it falls asleep and its brain timer pauses. Move or talk and it wakes up and says hi.
- **Breaks its brain every 4 minutes:** fix it by putting out sparks, tightening bolts and plugging in wires.

Everything runs in the browser, and nothing is sent to a server:

- **`index.html`:** the whole app.
- **Speech recognition:** done on the device by [vosk-browser](https://github.com/ccoreilly/vosk-browser) (Apache-2.0, `vendor/vosk.js`) with the small English Vosk model (`models/`, 41 MB). It works in the Fire tablet's Silk browser, which has no built-in speech recognition. The model downloads once and is then kept in the browser's cache storage.
- **Robot voice:** answers are spoken by [meSpeak](https://www.masswerk.at/mespeak/) (eSpeak compiled to JavaScript, GNU GPL, `vendor/mespeak.js`). Both voices then go through the same robot effect: a ring modulator, a bit-crusher, a metallic echo and a tinny speaker tone.
- **Camera:** frames are compared on the tablet and never saved or uploaded. Ember tells whether you're looking at it with Google's [MediaPipe](https://ai.google.dev/edge/mediapipe) face detector (Apache-2.0). It's loaded from jsDelivr and runs on the tablet; no video leaves the device.

The microphone and camera only work on an `https://` page, which GitHub Pages provides.

## Settings

Add these to the end of the page address, joined with `&`, for example `?name=Asher&away=60`:

- `name=Asher`: the name it greets
- `ask=60`: the longest gap between out-of-nowhere questions, in seconds (they come at a random time between a third of this and all of it; at most 30 in scary mode); `ask=off` turns them off
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
- `dragon=Ember`: the dragon's name
- `reach=0.12`: how much of the picture has to change to count as a reaching hand (lower is more sensitive)
- `debug`: shows test buttons, a box for typing questions, and a status line showing whether the mic, camera and speech recognition work
