import type { Command } from 'commander'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isCompiledBinary } from '../shared/portableConfig'

export interface ServiceOpts {
  nodePath: string
  /** Null in the single-file compiled binary — nodePath itself is the CLI, and no separate script argument is passed. */
  scriptPath: string | null
  args: string[]
  user: string
  label: string
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function quoteShellArg(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

/** macOS LaunchAgent — user-level, does not require sudo. (Pure — testable.) */
export function buildLaunchdPlist(opts: ServiceOpts): string {
  const argsXml = [...(opts.scriptPath ? [opts.scriptPath] : []), ...opts.args]
    .map((a) => `    <string>${escapeXml(a)}</string>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(opts.label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(opts.nodePath)}</string>
${argsXml}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/${escapeXml(opts.label)}.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/${escapeXml(opts.label)}.err.log</string>
</dict>
</plist>
`
}

/** Linux systemd system unit — starts automatically on boot/after a crash, requires sudo. (Pure — testable.) */
export function buildSystemdUnit(opts: ServiceOpts): string {
  const execArgs = [...(opts.scriptPath ? [opts.scriptPath] : []), ...opts.args].map(quoteShellArg).join(' ')
  return `[Unit]
Description=${opts.label}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${opts.user}
ExecStart=${quoteShellArg(opts.nodePath)} ${execArgs}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
`
}

const LABEL = 'tech.remana.relackout.artnet2usb-cli'
const SYSTEMD_UNIT_PATH = '/etc/systemd/system/artnet2usb-cli.service'

/**
 * Writing to /etc/systemd/system on Linux almost always requires sudo —
 * in that case os.userInfo().username returns 'root', so the service would be
 * generated as root by mistake. `sudo` leaves the real invoking user in
 * SUDO_USER; use it when present (systemd's User= field should be this user).
 */
function resolveInvokingUser(): string {
  const sudoUser = process.env.SUDO_USER
  return sudoUser && sudoUser !== 'root' ? sudoUser : os.userInfo().username
}

function launchdPlistPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)
}

/**
 * `install-service` / `uninstall-service` — sets up a background service that
 * starts automatically on boot/after a crash. Since this is a persistent
 * system change, the command writes/removes the service DEFINITION FILE but
 * does NOT itself run `launchctl load` / `systemctl enable --now` — it prints
 * the final activation step to the user as a copy-paste command.
 */
export function registerServiceCommands(program: Command): void {
  program
    .command('install-service')
    .description('Generate an autostart service definition (prints the command to enable it — does not run it)')
    .option('--command <cmd>', 'Which CLI command the service runs: auto or run', 'auto')
    .option('--config <dir>', 'Config directory to pass to the service (default: shared with the desktop app)')
    .action((opts: { command: string; config?: string }) => {
      if (opts.command !== 'auto' && opts.command !== 'run') {
        console.error(`Invalid --command: ${opts.command} (expected "auto" or "run")`)
        process.exitCode = 1
        return
      }
      // In the compiled single-file binary, execPath is the CLI itself; argv[1]
      // points to a virtual path inside the snapshot and must not be written to the service.
      const scriptPath = isCompiledBinary() ? null : path.resolve(process.argv[1])
      const args = [opts.command, ...(opts.config ? ['--config', opts.config] : [])]
      const serviceOpts: ServiceOpts = {
        nodePath: process.execPath,
        scriptPath,
        args,
        user: resolveInvokingUser(),
        label: LABEL
      }

      if (process.platform === 'darwin') {
        const file = launchdPlistPath()
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, buildLaunchdPlist(serviceOpts))
        console.log(`Wrote ${file}`)
        console.log('To enable and start it now, run:')
        console.log(`  launchctl load -w "${file}"`)
        console.log('To check status:')
        console.log(`  launchctl list | grep ${LABEL}`)
      } else if (process.platform === 'linux') {
        try {
          fs.writeFileSync(SYSTEMD_UNIT_PATH, buildSystemdUnit(serviceOpts))
        } catch (err) {
          console.error(`Could not write ${SYSTEMD_UNIT_PATH}: ${err instanceof Error ? err.message : String(err)}`)
          console.error('Re-run with sudo (e.g. `sudo artnet2usb-cli install-service`).')
          process.exitCode = 1
          return
        }
        console.log(`Wrote ${SYSTEMD_UNIT_PATH}`)
        console.log('To enable and start it now, run:')
        console.log('  sudo systemctl daemon-reload')
        console.log('  sudo systemctl enable --now artnet2usb-cli')
      } else {
        console.error(`install-service is not supported on ${process.platform} yet.`)
        process.exitCode = 1
      }
    })

  program
    .command('uninstall-service')
    .description('Remove the installed service definition (prints the command to disable it first)')
    .action(() => {
      if (process.platform === 'darwin') {
        const file = launchdPlistPath()
        console.log('Before removing, unload it:')
        console.log(`  launchctl unload -w "${file}"`)
        if (fs.existsSync(file)) {
          fs.rmSync(file)
          console.log(`Removed ${file}`)
        } else {
          console.log('No service file found.')
        }
      } else if (process.platform === 'linux') {
        console.log('Before removing, disable it:')
        console.log('  sudo systemctl disable --now artnet2usb-cli')
        if (fs.existsSync(SYSTEMD_UNIT_PATH)) {
          try {
            fs.rmSync(SYSTEMD_UNIT_PATH)
            console.log(`Removed ${SYSTEMD_UNIT_PATH}`)
            console.log('Then run: sudo systemctl daemon-reload')
          } catch (err) {
            console.error(`Could not remove ${SYSTEMD_UNIT_PATH}: ${err instanceof Error ? err.message : String(err)}`)
            console.error('Re-run with sudo, or remove it manually.')
            process.exitCode = 1
          }
        } else {
          console.log('No service file found.')
        }
      } else {
        console.error(`uninstall-service is not supported on ${process.platform}.`)
        process.exitCode = 1
      }
    })
}
