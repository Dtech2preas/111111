class FloorPlanModel extends EventEmitter {
    constructor() {
        super();
        this.reset();
    }

    reset() {
        this.data = {
            version: 2,
            id: `floorplan_${Date.now()}`,
            name: "New Floor Plan",
            units: "meters",
            scale: 0.01, // 1 canvas unit = 0.01 meters
            canvas: { width: 1000, height: 800 },
            walls: [],
            rooms: [],
            doors: [],
            windows: [],
            objects: [],
            labels: []
        };
        this.emit('change');
    }

    load(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (!data.version || !data.walls) {
                throw new Error("Invalid floor plan data");
            }
            // Migrate v1 to v2
            if (data.version === 1) {
                data.version = 2;
                if (!data.objects) data.objects = [];
                if (!data.labels) data.labels = [];
            }
            this.data = data;
            this.emit('change');
            return true;
        } catch (e) {
            console.error("Failed to load plan:", e);
            return false;
        }
    }

    toJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    cloneData() {
        return JSON.parse(this.toJSON());
    }

    // -- Elements --

    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }

    // Walls
    addWall(start, end, thickness = 10) {
        const wall = {
            id: this.generateId('wall'),
            type: 'wall',
            start: { x: start.x, y: start.y },
            end: { x: end.x, y: end.y },
            thickness: thickness
        };
        this.data.walls.push(wall);
        this.emit('change');
        return wall;
    }

    updateWall(id, updates) {
        const wall = this.data.walls.find(w => w.id === id);
        if (wall) {
            Object.assign(wall, updates);
            this.emit('change');
        }
    }

    removeWall(id) {
        this.data.walls = this.data.walls.filter(w => w.id !== id);
        this.emit('change');
    }

    // Rooms
    setRooms(roomsData) {
        this.data.rooms = roomsData.map((r, index) => {
            const existingRoom = this.data.rooms.find(er => this.areRoomsEqual(er.boundary, r.boundary));
            return {
                id: existingRoom ? existingRoom.id : this.generateId('room'),
                type: existingRoom ? existingRoom.type : 'room',
                name: existingRoom ? existingRoom.name : `Room ${index + 1}`,
                area: r.area,
                boundary: r.boundary
            };
        });
        this.emit('change');
    }

    areRoomsEqual(b1, b2) {
        if (b1.length !== b2.length) return false;
        // Simple check based on centroid or matching all points
        // Assuming boundaries are sorted or we can just check if all points match
        const sortPts = (pts) => [...pts].sort((a,b) => a.x === b.x ? a.y - b.y : a.x - b.x);
        const s1 = sortPts(b1);
        const s2 = sortPts(b2);
        for(let i=0; i<s1.length; i++) {
            if(Math.abs(s1[i].x - s2[i].x) > 0.1 || Math.abs(s1[i].y - s2[i].y) > 0.1) return false;
        }
        return true;
    }

    updateRoom(id, updates) {
        const room = this.data.rooms.find(r => r.id === id);
        if (room) {
            Object.assign(room, updates);
            this.emit('change');
        }
    }

    // Doors & Windows
    addDoor(wallId, position, width = 80, rotation = 0, flip = false) {
        const door = {
            id: this.generateId('door'),
            type: 'door',
            wallId: wallId,
            position: { x: position.x, y: position.y },
            width: width,
            rotation: rotation,
            flip: flip
        };
        this.data.doors.push(door);
        this.emit('change');
        return door;
    }

    addWindow(wallId, position, width = 100, rotation = 0) {
        const win = {
            id: this.generateId('window'),
            type: 'window',
            wallId: wallId,
            position: { x: position.x, y: position.y },
            width: width,
            rotation: rotation
        };
        this.data.windows.push(win);
        this.emit('change');
        return win;
    }

    // Objects
    addObject(type, position, size, rotation = 0) {
        const obj = {
            id: this.generateId('object'),
            type: type,
            position: { x: position.x, y: position.y },
            width: size.width,
            height: size.height,
            rotation: rotation
        };
        if (!this.data.objects) this.data.objects = [];
        this.data.objects.push(obj);
        this.emit('change');
        return obj;
    }

    // Labels
    addLabel(text, position, fontSize = 14, color = '#333') {
        const lbl = {
            id: this.generateId('label'),
            type: 'label',
            text: text,
            position: { x: position.x, y: position.y },
            fontSize: fontSize,
            color: color
        };
        if (!this.data.labels) this.data.labels = [];
        this.data.labels.push(lbl);
        this.emit('change');
        return lbl;
    }

    updateElement(id, updates) {
        const el = this.getElementById(id);
        if (el) {
            Object.assign(el, updates);
            this.emit('change');
        }
    }

    removeElement(id) {
        this.data.doors = this.data.doors.filter(d => d.id !== id);
        this.data.windows = this.data.windows.filter(w => w.id !== id);
        if (this.data.objects) this.data.objects = this.data.objects.filter(o => o.id !== id);
        if (this.data.labels) this.data.labels = this.data.labels.filter(l => l.id !== id);
        this.removeWall(id); // Will remove if it's a wall and trigger change
    }

    getElementById(id) {
        return this.data.walls.find(e => e.id === id) ||
               this.data.doors.find(e => e.id === id) ||
               this.data.windows.find(e => e.id === id) ||
               this.data.rooms.find(e => e.id === id) ||
               (this.data.objects && this.data.objects.find(e => e.id === id)) ||
               (this.data.labels && this.data.labels.find(e => e.id === id));
    }
}