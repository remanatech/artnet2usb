import { contextBridge, ipcRenderer } from 'electron'

/** Renderer bridge — no auth, narrow surface. */
contextBridge.exposeInMainWorld('artnet2usb', {
  invoke: (channel: string, ...args: unknown[]) => {
    const allowed = [
      'state:get',
      'devices:rename',
      'routes:upsert',
      'routes:remove',
      'routes:start',
      'routes:stop',
      'routes:freeze',
      'settings:set',
      'preview:set',
      'app:openExternal',
      'serial:diagnose',
      'serial:fixPermissions'
    ]
    if (!allowed.includes(channel)) throw new Error(`Unauthorized channel: ${channel}`)
    return ipcRenderer.invoke(channel, ...args)
  },
  onPreviewFrame: (cb: (universe: number, data: number[]) => void) => {
    const h = (_e: unknown, universe: number, data: number[]) => cb(universe, data)
    ipcRenderer.on('preview:frame', h)
    return () => ipcRenderer.removeListener('preview:frame', h)
  }
})
