
import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

let wss: WebSocketServer;

export const initWebSocketServer = (server: Server) => {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
        console.log('Client connected');
        ws.on('close', () => console.log('Client disconnected'));
    });
};

export const sendWebSocketMessage = (data: any) => {
    if (wss) {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }
};
