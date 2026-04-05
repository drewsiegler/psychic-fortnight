# psychic-fortnight
This is a tool for grassroots organizers to plan and prioritize

So, a quick note--this was originally created by someone who has absolutely no clue what they're doing, has never used GitHub before, doesn't code, thinks computers exist because of a combination of hamsters on wheels and a healthy dose of magic, and is prone to egregious typos.

That's me, Drew Siegler.

But, I'm a grassroots community organizer, and I felt like for getting a handle on both big picture and minute details of organizing was a major source of burnout on the job, and that the existing tools both fell short and were cost-prohibitive for the grassroots community. So I asked Claude to make this prototype of a Gantt chart that can be created via outline, with the ability for natural language for dates, and so now there's this.

If you're someone who, unlike me, knows what you're doing (at least comparatively, which in this case, means if you're able to print "Hello World" you're lightyears ahead of me), and you'd like to toy around with this to develop useful tools for grassroots community organizers, have at it.

Also, feel free to reach me at andrew.siegler@proton.me.

Thanks.

# Gantt Planner

A lightweight Gantt chart app with natural language date input. Type tasks like an outline, set dates in plain English ("next friday", "in 2 weeks", "may 15"), and watch your timeline build itself.

## Features

- **Natural language dates** — type "tomorrow", "next fri", "in 2 weeks", "may 15", "eom", "+3d"
- **Outline-style task entry** — Tab to indent, Shift+Tab to outdent, Enter for new tasks
- **Collapsible groups** — click ▶/▼ to collapse/expand, or use Collapse All / Expand All
- **Progress tracking** — slider on each task, parent tasks auto-average their children
- **Drag to reorder** — grab the ⠿ handle to move tasks (parents bring their children)
- **Auto-saves** — everything persists in your browser automatically
- **Visual Gantt chart** — bars with progress fill, today marker, weekend shading

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Deploy to Vercel

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
3. Click "Add New Project"
4. Import your GitHub repository
5. Vercel auto-detects Vite — just click "Deploy"
6. You'll get a URL like `your-project.vercel.app` in about 60 seconds

Every time you push to GitHub, Vercel auto-deploys the update.

## Tech

- React 18 + Vite
- Zero external dependencies beyond React
- All data stored in browser localStorage
- No backend, no accounts, no tracking

## License

GNU Affero General Public License v3.0 (AGPL-3.0)
