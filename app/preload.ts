import { contextBridge, ipcRenderer } from 'electron'

/** Renderer köprüsü — auth yok, dar yüzey. */
contextBridge.exposeInMainWorld('artnet2usb', {
  invoke: (channel: string, ...args: unknown[]) => {
    const allowed = [
      'state:get',
      'devices:rename',
      'routes:upsert',
      'routes:remove',
      'routes:start',
      'routes:stop',
      'settings:set',
      'preview:set',
      'app:openExternal'
    ]
    if (!allowed.includes(channel)) throw new Error(`İzinsiz kanal: ${channel}`)
    return ipcRenderer.invoke(channel, ...args)
  },
  onPreviewFrame: (cb: (universe: number, data: number[]) => void) => {
    const h = (_e: unknown, universe: number, data: number[]) => cb(universe, data)
    ipcRenderer.on('preview:frame', h)
    return () => ipcRenderer.removeListener('preview:frame', h)
  }
})
