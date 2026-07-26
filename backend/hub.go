package main

import (
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub broadcasts room events to connected clients, keyed by session id.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]map[*websocket.Conn]bool
}

func NewHub() *Hub {
	return &Hub{rooms: map[string]map[*websocket.Conn]bool{}}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func (h *Hub) add(session string, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[session] == nil {
		h.rooms[session] = map[*websocket.Conn]bool{}
	}
	h.rooms[session][c] = true
}

func (h *Hub) remove(session string, c *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if m := h.rooms[session]; m != nil {
		delete(m, c)
		if len(m) == 0 {
			delete(h.rooms, session)
		}
	}
}

// Broadcast sends a JSON message to everyone in a room.
func (h *Hub) Broadcast(session string, v any) {
	h.mu.Lock()
	conns := make([]*websocket.Conn, 0, len(h.rooms[session]))
	for c := range h.rooms[session] {
		conns = append(conns, c)
	}
	h.mu.Unlock()
	for _, c := range conns {
		if err := c.WriteJSON(v); err != nil {
			h.remove(session, c)
			c.Close()
		}
	}
}
