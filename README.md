# Fake Chat

AI chat for your stream. A crowd of fake viewers who hear what you say, see your screen, and talk like a real community, with their own personalities, running jokes and memory.

**Use it:** open the GitHub Pages link for this repo in Chrome or Edge.

Everything runs in your browser. Your API key, OBS password, viewers and memory are saved in your browser only and never stored in this repo.

## What it does

- **Hears you.** Talk and chat reacts within a second or two. It answers questions, replies when you say a viewer's name, and keeps conversations going between viewers.
- **Sees your game.** Share your screen and chat reacts to what's happening, including big changes like deaths or new areas.
- **Real personalities.** Every viewer has a personality, badge and talk level you can edit.
- **Remembers.** Chat learns things you say and big moments, and brings them up later, even next stream.
- **Live tools.** Fake subs, follows, gift subs, bits and raids. Polls with live voting. Click any message to reply, time someone out, ban them or delete it. Make a viewer say something.
- **Looks how you want.** Six themes (Classic, Bubbles, Minecraft, Neon, Minimal, Cozy) plus fonts, colours, boxes, see-through panels, avatars, emoji emotes, animations and more.
- **Voices.** Optional text to speech with a different voice for each viewer.
- **Works with Claude** (Fast, Smart or Genius), OpenAI, OpenRouter, Groq, or Ollama. Or offline with simple messages.

## OBS

1. In OBS: Tools, WebSocket Server Settings. Tick Enable, then Show Connect Info and copy the password.
2. Add a Browser source with this site's link, 400 by 700.
3. On the OBS page of the app, paste the password and hit Connect to OBS.

Add `?view=count` to the link for a viewer count badge, or `?view=poll` for polls on their own.

## Working on it

The app lives in `app/` (React, TypeScript, Vite). The built site goes to the repo root so Pages serves it.

```
cd app
npm install
npm run dev     # local dev server
npm run build   # rebuilds index.html and assets/ in the repo root
```

## Fonts

Fonts are bundled from Fontsource. The Minecraft font option uses [Monocraft](https://github.com/IdreesInc/Monocraft) by Idrees Hassan under the SIL Open Font License 1.1, see `licenses/Monocraft-OFL.txt`.
