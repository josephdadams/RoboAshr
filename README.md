# RoboAshr

A talking robot for Asher's tablet.

- **Copies you:** talk to it and it says your words back in a robot voice, with its jaw chomping along.
- **Answers questions:** start with "Robo…", like "Robo, tell me a joke". It knows jokes, facts, the time and date, math, animal sounds, spelling, counting, coin flips and dice. It can also dance and sing. Answers come from a script, not AI.
- **Knows when you're there:** it uses the front camera to notice movement. When nobody's around it falls asleep and its brain timer pauses. Move or talk and it wakes up and says hi.
- **Breaks its brain every 4 minutes:** fix it by putting out sparks, tightening bolts and plugging in wires.

Everything is in one file, `index.html`, and it all runs in the browser. Camera frames are compared on the tablet and never saved or uploaded. Answering questions uses the browser's built-in speech recognition, where available; Chrome sends that audio to Google to turn it into text. If the browser has no speech recognition, RoboAshr still copies and still notices you.

The microphone and camera only work on an `https://` page, which GitHub Pages provides.

## Settings

Add these to the end of the page address, joined with `&`, for example `?name=Asher&away=60`:

- `name=Asher`: the name it greets
- `minutes=4`: how long until the brain breaks
- `away=45`: seconds without motion or voice before it falls asleep
- `motion=0.02`: how much movement wakes it (lower is more sensitive)
- `pitch=1.3`: how high the copying voice is
- `sens=1.5`: makes it pick up a quiet voice more easily
- `camera=off`: never uses the camera, never sleeps
- `talk=off`: copy only, no questions
- `debug`: shows test buttons, a box for typing questions, and a status line showing whether the mic, camera and speech recognition work
