# RoboAshr

A talking robot for Asher's tablet. Talk to it and it copies you back in a robot voice, with its jaw chomping along. Every 4 minutes its brain breaks, and you have to fix it by putting out sparks, tightening bolts and plugging in wires.

Everything is in one file, `index.html`. The microphone only works on an `https://` page, which GitHub Pages provides.

## Settings

Add these to the end of the page address:

- `?minutes=4`: how long until the brain breaks
- `pitch=1.3`: how high the robot voice is
- `sens=1.5`: makes it pick up a quiet voice more easily
- `?debug`: shows Break / Test voice / Fix buttons

Combine them like `?minutes=2&sens=1.5`.
