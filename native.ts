/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { app, globalShortcut, BrowserWindow } from "electron";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { Settings } from "@main/settings";

let registeredShortcut: string | null = null;
let httpServer: ReturnType<typeof createServer> | null = null;
let stateMonitorInterval: NodeJS.Timeout | null = null;
const HTTP_PORT = 37320;
const STATE_FILE_PATH = join(tmpdir(), "vencord-krisp-state.txt");
let lastWrittenState: string | null = null;

function triggerKrispToggle() {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
        console.warn("[Krisp Toggle Native] No window available");
        return;
    }
    win.webContents.executeJavaScript(`
        (() => {
            if (window.VencordKrispToggle?.toggle) {
                window.VencordKrispToggle.toggle();
            } else {
                console.error("[Krisp Toggle Native] Toggle function not found");
            }
        })();
    `).catch(err => {
        console.error("[Krisp Toggle Native] Failed to execute toggle:", err);
    });
}

async function getKrispState(): Promise<string> {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
        return "Unknown";
    }
    
    try {
        const state = await win.webContents.executeJavaScript(`
            (() => {
                if (window.VencordKrispToggle?.getState) {
                    return window.VencordKrispToggle.getState();
                }
                return "Unknown";
            })();
        `);
        return state;
    } catch (err) {
        console.error("[Krisp Toggle Native] Failed to get state:", err);
        return "Unknown";
    }
}

async function checkPluginInstalled(): Promise<boolean> {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) {
        return false;
    }
    
    try {
        const installed = await win.webContents.executeJavaScript(`
            (() => {
                return typeof window.VencordKrispToggle !== 'undefined' && 
                       typeof window.VencordKrispToggle.toggle === 'function';
            })();
        `);
        return installed;
    } catch (err) {
        console.error("[Krisp Toggle Native] Failed to check plugin:", err);
        return false;
    }
}

function writeStateFile(state: string) {
    if (state === lastWrittenState) {
        return;
    }
    
    try {
        writeFileSync(STATE_FILE_PATH, state, "utf8");
        lastWrittenState = state;
    } catch (err) {
        console.error("[Krisp Toggle Native] Failed to write state file:", err);
    }
}

function startStateMonitoring() {
    if (stateMonitorInterval) return;
    
    stateMonitorInterval = setInterval(async () => {
        const state = await getKrispState();
        writeStateFile(state);
    }, 2000);
}

function stopStateMonitoring() {
    if (stateMonitorInterval) {
        clearInterval(stateMonitorInterval);
        stateMonitorInterval = null;
    }
}

function startHttpServer() {
    if (httpServer) {
        console.warn("[Krisp Toggle Native] HTTP server already running");
        return;
    }

    httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Content-Type", "application/json");

        if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === "POST" && req.url === "/toggle") {
            triggerKrispToggle();
            setTimeout(async () => {
                const state = await getKrispState();
                res.writeHead(200);
                res.end(JSON.stringify({ success: true, state }));
            }, 100);
            return;
        }

        if (req.method === "GET" && req.url === "/health") {
            res.writeHead(200);
            res.end(JSON.stringify({ status: "ok", port: HTTP_PORT }));
            return;
        }

        if (req.method === "GET" && req.url === "/plugin-check") {
            const installed = await checkPluginInstalled();
            res.writeHead(200);
            res.end(JSON.stringify({ installed }));
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not found" }));
    });

    httpServer.listen(HTTP_PORT, "127.0.0.1", () => {
        console.log(`[Krisp Toggle Native] HTTP API server running on http://localhost:${HTTP_PORT}`);
    });

    httpServer.on("error", (err) => {
        console.error("[Krisp Toggle Native] HTTP server error:", err);
    });
}

function stopHttpServer() {
    if (httpServer) {
        httpServer.close(() => {
            console.log("[Krisp Toggle Native] HTTP server stopped");
        });
        httpServer = null;
    }
}

function registerGlobalShortcut(keybind: string) {
    if (registeredShortcut) {
        globalShortcut.unregister(registeredShortcut);
        registeredShortcut = null;
    }
    
    const electronKeybind = keybind
        .split('+')
        .map(key => {
            const k = key.trim().toLowerCase();
            if (k === 'ctrl') return 'Control';
            if (k === 'alt') return 'Alt';
            if (k === 'shift') return 'Shift';
            return k.charAt(0).toUpperCase() + k.slice(1);
        })
        .join('+');
        
    try {
        const success = globalShortcut.register(electronKeybind, triggerKrispToggle);
        if (success) {
            registeredShortcut = electronKeybind;
            console.log("[Krisp Toggle Native] Registered global shortcut:", electronKeybind);
        } else {
            console.error("[Krisp Toggle Native] Failed to register shortcut:", electronKeybind);
        }
    } catch (error) {
        console.error("[Krisp Toggle Native] Error registering shortcut:", error);
    }
}

app.whenReady().then(async () => {
    registerGlobalShortcut("Control+Shift+K");
    
    setTimeout(async () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            try {
                const streamDeckEnabled = await win.webContents.executeJavaScript(`
                    (() => {
                        return window.VencordKrispToggle?.streamDeckEnabled ?? true;
                    })();
                `);
                
                if (streamDeckEnabled) {
                    writeStateFile("Unknown");
                    startStateMonitoring();
                    startHttpServer();
                    console.log("[Krisp Toggle Native] Plugin loaded with Stream Deck integration");
                    console.log("[Krisp Toggle Native] State file:", STATE_FILE_PATH);
                } else {
                    console.log("[Krisp Toggle Native] Plugin loaded (Stream Deck integration disabled)");
                }
            } catch (err) {
                console.error("[Krisp Toggle Native] Failed to check Stream Deck setting:", err);
            }
        }
    }, 1000);
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
    stopStateMonitoring();
    stopHttpServer();
    console.log("[Krisp Toggle Native] Cleanup complete");
});

export function updateKeybind(keybind: string) {
    registerGlobalShortcut(keybind);
}