#!/usr/bin/env node
'use strict'

/**
 * Bağımsız, minimal Art-Net -> USB DMX köprüsü.
 *
 * relackout/artnet2usb'nin ana kod tabanından (app/artnet.ts, app/dmxOutput.ts)
 * TAMAMEN BAĞIMSIZ, tek dosyalık bir uygulama. Amaç: mevcut app/dmxOutput.ts'teki
 * `serialport`'un `set({brk:true/false})` ile break üretme yöntemi sahada
 * çözülemeyen bir kanal kayması + değer değişirken titreme sorununa yol açtı
 * (MAB eklemek ve flush() denemek çözmedi). Bu dosya break'i FARKLI bir
 * mekanizmayla üretiyor: OS ioctl'i yerine BAUD RATE DEĞİŞTİRME tekniği
 * (düşük baud'da tek bir 0x00 baytı, hattı yeterince uzun süre LOW'da tutarak
 * break'e benzer bir koşul üretir) — birçok Node.js DMX projesinde
 * `set({brk})`'e göre daha taşınabilir/güvenilir kabul edilen bir yöntem.
 *
 * Kullanım: node dmx-bridge.js <seri-port-yolu> [universe] [hz]
 */

const { SerialPort } = require('serialport')
const dgram = require('node:dgram')

const DEVICE_PATH = process.argv[2]
const UNIVERSE = Number(process.argv[3] || 0)
const HZ = Number(process.argv[4] || 40)

if (!DEVICE_PATH) {
  console.error('Kullanım: node dmx-bridge.js <seri-port-yolu> [universe] [hz]')
  process.exit(1)
}

function ts() {
  return new Date().toISOString().slice(11, 19)
}

// --- Art-Net alma: app/artnet.ts'teki parseArtDmx ile birebir aynı bayt düzeni ---
const ARTNET_PORT = 6454
const HEADER = Buffer.from('Art-Net\0', 'ascii')
const OP_DMX = 0x5000

const universeData = Buffer.alloc(512)
let lastArtnetAt = 0

const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
sock.on('message', (msg) => {
  if (msg.length < 19 || !msg.subarray(0, 8).equals(HEADER)) return
  if (msg.readUInt16LE(8) !== OP_DMX) return
  const subUni = msg[14]
  const net = msg[15]
  const universe = ((net & 0x7f) << 8) | subUni
  if (universe !== UNIVERSE) return
  const len = (msg[16] << 8) | msg[17]
  const data = msg.subarray(18, 18 + Math.min(len, 512))
  data.copy(universeData, 0)
  lastArtnetAt = Date.now()
})
sock.on('error', (err) => console.error(`[${ts()}] artnet socket hatası:`, err.message))
sock.bind(ARTNET_PORT, () => {
  try {
    sock.setBroadcast(true)
  } catch {
    /* platform izin vermezse önemli değil, dinleme pasif de çalışır */
  }
  console.log(`[${ts()}] Art-Net dinleniyor (universe ${UNIVERSE}), UDP ${ARTNET_PORT}`)
})

// --- USB DMX çıkışı: baud rate değiştirerek break üretimi ---
const DATA_BAUD = 250000
const BREAK_BAUD = 9600 // düşük baud'da 1 bayt (0x00) ~1ms hat-LOW koşulu üretir (DMX min break 92µs)

const port = new SerialPort({
  path: DEVICE_PATH,
  baudRate: DATA_BAUD,
  dataBits: 8,
  stopBits: 2,
  parity: 'none',
  autoOpen: false
})

let writing = false
let framesSent = 0
let lastError = null

function sendFrame() {
  if (writing || !port.isOpen) return
  if (lastArtnetAt === 0) return // henüz hiç Art-Net verisi gelmedi
  writing = true

  port.update({ baudRate: BREAK_BAUD }, (err) => {
    if (err) {
      lastError = err.message
      writing = false
      return
    }
    port.write(Buffer.from([0x00]), (err2) => {
      if (err2) {
        lastError = err2.message
        writing = false
        return
      }
      port.drain((err3) => {
        if (err3) {
          lastError = err3.message
          writing = false
          return
        }
        port.update({ baudRate: DATA_BAUD }, (err4) => {
          if (err4) {
            lastError = err4.message
            writing = false
            return
          }
          setTimeout(() => {
            const frame = Buffer.alloc(513)
            frame[0] = 0 // start code
            universeData.copy(frame, 1, 0, 512)
            port.write(frame, (err5) => {
              if (err5) {
                lastError = err5.message
                writing = false
                return
              }
              port.drain((err6) => {
                lastError = err6 ? err6.message : null
                if (!err6) framesSent++
                writing = false
              })
            })
          }, 1) // MAB
        })
      })
    })
  })
}

port.open((err) => {
  if (err) {
    console.error(`[${ts()}] Port açılamadı (${DEVICE_PATH}):`, err.message)
    process.exit(1)
  }
  console.log(`[${ts()}] Port açıldı: ${DEVICE_PATH}, ${HZ}Hz, break-baud=${BREAK_BAUD}`)
  setInterval(sendFrame, Math.round(1000 / HZ))
  setInterval(() => {
    console.log(`[${ts()}] frames: ${framesSent}${lastError ? `  hata: ${lastError}` : ''}`)
  }, 2000)
})

function shutdown() {
  console.log(`\n[${ts()}] kapatılıyor...`)
  sock.close()
  port.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
