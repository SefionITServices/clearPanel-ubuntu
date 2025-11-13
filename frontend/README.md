# clearPanel frontend

Fresh Vite + React + TypeScript starter.

## Scripts

- `npm run dev` â€“ start development server (defaults to port 8080, will switch if busy)
- `npm run build` â€“ type-check and build to `dist/`
- `npm run preview` â€“ preview the production build

## API Proxy
Requests to `/api/*` are proxied to `http://localhost:3334` (configure in `vite.config.ts`).

## Watcher Limits (Linux ENOSPC)
If you see `ENOSPC: System limit for number of file watchers reached`, you can:

```bash
# Temporary (per session)
CHOKIDAR_USEPOLLING=1 npm run dev

# Permanent increase (recommended)
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl fs.inotify.max_user_instances=1024
# Make persistent
echo 'fs.inotify.max_user_watches=524288' | sudo tee -a /etc/sysctl.conf
echo 'fs.inotify.max_user_instances=1024' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## Troubleshooting
- Missing types: ensure `node_modules` installed and `@types/node` present.
- Port conflict: Vite auto-selects next free port and prints it in the console.

## Next Steps
- Integrate routing and UI components.
- Add ESLint + Prettier config if desired.

